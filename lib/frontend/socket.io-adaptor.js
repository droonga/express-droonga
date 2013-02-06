var socketIo = require('socket.io');
var defaultCommands = require('./default-commands/socket.io');

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

  function createRequestHandler(command, socket, requestBuilder) {
    return (function(data) {
      if (requestBuilder)
        data = requestBuilder(data);
      connection.emitMessage(command, data, null, { sessionId: socket.id });
    });
  }

  function createBackendMessageHandler(socket) {
    return (function(envelope) {
      if (envelope.sessionId && envelope.sessionId != socket.id)
        return;

      var event = envelope.type;

      var data;
      var resultTypeMatch = envelope.type.match(/^(.+)\.result$/);
      if (resultTypeMatch && unifiedCommandSet[resultTypeMatch[1]]) {
        var command = unifiedCommandSet[resultTypeMatch[1]];
        if (command.responseBuilder)
          data = command.responseBuilder(envelope);
        if (command.responseEvent)
          event = command.responseEvent;
      }

      if (!data)
        data = sanitizeBackendMessage(envelope);

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
    if (typeof commandSet == 'string')
      commandSet = require(commandSet);

    Object.keys(commandSet).forEach(function(command) {
      var definition = commandSet[command];
      if (!definition || definition.method) // ignore REST command
        return;
      unifiedCommandSet[command] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(command) {
    var definition = unifiedCommandSet[command];
    if (!definition || typeof definition != 'object') // ignore not a command definition
      return;
    registeredCommands.push({ command:    command,
                              definition: definition });
  });

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var messageHandlers = [];
    registeredCommands.forEach(function(command) {
      socket.on(command.command,
                createRequestHandler(command.command,
                                     socket,
                                     command.definition.requestBuilder));
    });

    var backendMessageHandler = createBackendMessageHandler(socket);
    connection.on('message', backendMessageHandler);

    var errorHandler = createErrorHandler(socket);
    connection.on('error', errorHandler);

    socket.on('disconnect', function() {
      connection.removeListener('message', backendMessageHandler);
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });
  });

  return registeredCommands;
}
