var socketIo = require('socket.io');
var model = require('../model');
var defaultCommands = require('./default-commands/socket.io');

var DEFAULT_TIMEOUT = 10 * 1000;

function deepClone(base) {
  if (!base || typeof base != 'object')
    return base;

  var cloned = Object.create(null);
  Object.keys(base).forEach(function(key) {
    cloned[key] = deepClone(base[key]);
  });
  return cloned;
}

function sanitizeBackendMessage(envelope) {
  return {
    statusCode: envelope.statusCode,
    body: deepClone(envelope.body)
  };
}
exports.sanitizeBackendMessage = sanitizeBackendMessage;

exports.register = function(application, server, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  if (!server)
    throw new Error('A server instance is required!');

  function createClientMessageHandler(commandName, socket) {
    return (function(data) {
      var commandDefinition = unifiedCommandSet[commandName];

      if (commandDefinition.toBackend) {
        var result = commandDefinition.toBackend(commandName, data);
        commandName = result[0];
        data = result[1];
      }

      var callback = null;
      var options = {};
      if (model.isA(commandDefinition, model.RequestResponse)) {
        callback = function(envelope) {
          var event = event.type;
          var data = envelope.body;

          if (commandDefinition.toClient) {
            var result = commandDefinition.toClient(event, data);
            event = result[0];
            data = result[1];
          }

          socket.emit(event, data);
        };
        options.timeout = DEFAULT_TIMEOUT;
      }

      connection.emitMessage(commandName, data, callback, options);
    });
  }

  function createPublishedMessageHandler(commandName, socket) {
    return (function(envelope) {
      var commandDefinition = unifiedCommandSet[commandName];

      var event = envelope.type;
      var data = envelope.body;

      if (commandDefinition.toClient) {
        var result = commandDefinition.toClient(event, data);
        event = result[0];
        data = result[1];
      }

      socket.emit(event, data);
    });
  }

  function createErrorHandler(socket) {
    return (function(error) {
      socket.emit('error', error);
    });
  }

  var commandSets = [defaultCommands].concat(params.plugins || []);
  var unifiedCommandSet = {};
  commandSets.forEach(function(commandSet) {
    Object.keys(commandSet).forEach(function(commandName) {
      var definition = commandSet[commandName];
      if (!model.isA(definition, model.SocketCommand))
        return;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!model.isA(definition, model.SocketCommand))
      return;
    registeredCommands.push({ name:       commandName,
                              definition: definition });
  });

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var messageHandlers = [];
    registeredCommands.forEach(function(command) {
      socket.on(command.name,
                createClientMessageHandler(command.name, socket));

      if (model.isA(command.definition, model.PublishSubscribe)) {
        var publishedMessageHandler = createPublishedMessageHandler(command.name, socket);
        connection.on(command.name, publishedMessageHandler);
      }
    });

    var errorHandler = createErrorHandler(socket);
    connection.on('error', errorHandler);

    socket.on('disconnect', function() {
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });
  });

  return registeredCommands;
}
