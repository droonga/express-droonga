/**
 * var connection = new Connection({ tag:  'groonga',
 *                                   host: 'localhost',
 *                                   port: 24224 });
 *
 * // for REST APIs
 * connection.emitMessage(
 *   { command: 'search',
 *     query:   'foobar' },
 *   function callback(result) {
 *     // codes to handle results from the backend
 *   }
 * );
 *
 * // for socket.io APIs
 * connection.on('notification', function listener(messageBody) { ... });
 * connection.emitVolatileMessage({ command: 'reindex' });
 */

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
    socket.on(self._params.tag + '.message',
              self._handleMessage.bind(self));
  });
  this._socket.set('log level', 1);
};

Connection.prototype._handleHttpRequest = function(request, response) {
};

Connection.prototype._handleMessage = function(message) {
  var replyTo = message['reply_to'];
  if (replyTo) {
    this.emit('replyTo:' + replyTo, message.body);
  }
};

function createId() {
  return Date.now() + ':' + Math.round(Math.random() * 65536);
}

Connection.prototype.emitMessage = function(message, callback) {
  var id = createId();
  var message = {
    id:   id,
    body: message
  };
  this.once('replyTo:' + id, callback);
  this._sender.emit('message', message);
};

Connection.prototype.emitVolatileMessage = function(message) {
  var id = createId();
  var message = {
    id:   id,
    body: message
  };
  this._sender.emit('message', message);
};

export.Connection = Connection;
