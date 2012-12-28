var EventEmitter = require('events').EventEmitter;
var http = require('http');
var socketIo = require('socket.io');
var fluent = require('fluent-logger');

function Connection(params) {
  this._params = params;
  this._init();
}

Connection.prototype = new EventEmitter();

Connection.prototype._init = function() {
  this._callbacks = {};

  this._sender = (
    this._params.sender ||
    fluent.createFluentSender(this._params.tag,
                              { host: this._params.host,
                                port: this._params.port })
  );
  this._server = http.createServer(this._handleHttpRequest.bind(this));
  this._socket = socketIo.listen(this._server);

  var self = this;
  this._socket.sockets.on('connection', function(socket) {
    socket.on(self._params.tag + '.result',
              self._handleResult.bind(self));
  });
  this._socket.set('log level', 1);
};

Connection.prototype._handleHttpRequest = function(request, response) {
};

Connection.prototype._handleResult = function(data) {
  var id = data['query']['requestid']
  var callbck = this._callbacks[id];
  if (callback) {
    delete this._callbacks[id];
    callback(data['result']);
  } else {
    // something went wrong;
  }
};

function createId() {
  return Date.now() + ':' + Math.round(Math.random() * 65536);
}

Connection.prototype.emitMessage = function(message, callback) {
  var id = createId();
  var message = {
    requestid: id,
    command:   'search',
    query:     query
  };
  this._callbacks[id] = callback;
  this._sender.emit('query', message);
};

export.Connection = Connection;
