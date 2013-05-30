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
    return (function() {
      var commandDefinition = unifiedCommandSet[commandName];
      if (!commandDefinition)
        return;

      var args = Array.prototype.slice.call(arguments, 0);
      var data = args.pop();
      var eventSuffix = args.join('.');

      var event = commandName;
      if (commandDefinition.toBackend) {
        var result = commandDefinition.toBackend(event, data);
        event = result[0];
        data = result[1];
      }

      var callback = null;
      var options = {};
      if (model.RequestResponse.isInstance(commandDefinition)) {
        callback = function(error, envelope) {
          if (error) {
            socket.emit('error', error);
            return;
          }

          var responseEvent = envelope.type;
          var responseData = envelope.body;

          if (commandDefinition.toClient) {
            var result = commandDefinition.toClient(responseEvent, responseData);
            responseEvent = result[0];
            responseData = result[1];
          }

          if (eventSuffix)
            responseEvent += '.' + eventSuffix;

          socket.emit(responseEvent, responseData);
        };
        options.timeout = DEFAULT_TIMEOUT;
      } else if (model.PublishSubscribe.isInstance(commandDefinition)) {
        event += '.subscribe';
      }

      options.sessionId = socket.id;
      connection.emitMessage(event, data, callback, options);
    });
  }

  function createPublishedMessageHandler(commandName, socket) {
    return (function(body) {
      var commandDefinition = unifiedCommandSet[commandName];

      var event = commandName;
      var data = body;

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
      if (!model.SocketCommand.isInstance(definition))
        return;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!model.SocketCommand.isInstance(definition))
      return;
    registeredCommands.push({ name:       commandName,
                              definition: definition });
  });

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var events = [];
    var handlers = {};
    registeredCommands.forEach(function(command) {
      if (model.PublishSubscribe.isInstance(command.definition)) {
        socket.on(command.name + '.subscribe',
                  createClientMessageHandler(command.name, socket));

        var publishedMessageHandler = createPublishedMessageHandler(command.name, socket);
        connection.on(command.name, publishedMessageHandler);
        events.push(command.name);
        handlers[command.name] = publishedMessageHandler;
      } else {
        socket.on(command.name,
                  createClientMessageHandler(command.name, socket));
      }
    });

    var errorHandler = createErrorHandler(socket);
    connection.on('error', errorHandler);

    socket.on('disconnect', function() {
      events.forEach(function(event) {
        connection.removeListener(event, handlers[event]);
      });
      events = undefined;
      handlers = undefined;
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });
  });

  return registeredCommands;
}
