var socketIo = require('socket.io');

var commands = [
  'status',
  'search',
  'createtable',
  'removetable',
  'createcolumn',
  'removecolumn',
  'loadrecord',
  'loadrecords',
];
exports.commands = commands;

function deepClone(base) {
  if (!base || typeof base != 'object')
    return base;

  var cloned = Object.create(null);
  Object.keys(base).forEach(function(key) {
    cloned[key] = deepClone(base[key]);
  });
  return cloned;
}

function buildResultData(envelope) {
  return {
    statusCode: envelope.statusCode,
    body: deepClone(envelope.body)
  };
}
exports.buildResultData = buildResultData;

exports.register = function(application, server, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  function createRequestHandler(command, socket) {
    return (function(data) {
      connection.emitMessage(command, data);
    });
  }

  function createResultHandler(command, socket) {
    return (function(envelope) {
      if (/\.result/.test(envelope.type)) {
        var data = buildResultData(envelope);
        socket.emit(envelope.type, data);
      }
    });
  }

  function createErrorHandler(socket) {
    return (function(error) {
      socket.emit('error', error);
    });
  }

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var messageHandlers = [];
    commands.concat(params.extraCommands || [])
      .forEach(function(command) {
        socket.on(command, createRequestHandler(command, socket));
        var handler = createResultHandler(command, socket);
        messageHandlers.push(handler);
        connection.on('message', handler);
      });

    var errorHandler = createErrorHandler(socket);
    connection.on('error', errorHandler);

    socket.on('disconnect', function() {
      messageHandlers.forEach(function(handler) {
        connection.removeListener('message', handler);
      });
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });
  });
}
