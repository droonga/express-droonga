var Connection = require('./backend-adaptor').Connection;
var socketIo = require('socket.io');

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

exports.registerSocketHandlers = function(application, server, params) {
  params = params || {};
  var connection = params.connection || new Connection(params);

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

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    [
      'status',
      'search',
      'createtable',
      'removetable',
      'createcolumn',
      'removecolumn',
      'loadrecord',
      'loadrecords',
    ].forEach(function(command) {
      socket.on(command, createRequestHandler(command, socket));
      connection.on('message', createResultHandler(command, socket));
    });
  });
}
