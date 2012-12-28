/**
 * var connection = new Connection({ tag:        'groonga',
 *                                   host:       'localhost',
 *                                   port:       24224,
 *                                   listenPort: 10030 });
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
 * // volatile message
 * connection.emitMessage({ command: 'reindex' });
 */

var EventEmitter = require('events').EventEmitter;
var socketIo = require('socket.io');
var fluent = require('fluent-logger');

var DEFAULT_FLUENT_TAG  = 'groonga';
var DEFAULT_FLUENT_HOST = 'localhost';
var DEFAULT_FLUENT_PORT = 24224;
var DEFAULT_LISTEN_PORT = 10030;

function Connection(params) {
  this._params = params || {};
  this._init();
}

Connection.prototype = new EventEmitter();

Connection.prototype._init = function() {
  this._callbacks = {};

  this._sender = (
    this._params.sender ||
    fluent.createFluentSender(this._params.tag || DEFAULT_FLUENT_TAG,
                              { host: this._params.host || DEFAULT_FLUENT_HOST,
                                port: this._params.port || DEFAULT_FLUENT_PORT })
  );
  this._socket = socketIo.listen(this._params.listenPort || DEFAULT_LISTEN_PORT);

  var self = this;
  this._socket.sockets.on('connection', function(socket) {
    socket.on((self._params.tag || DEFAULT_FLUENT_TAG)+ '.message',
              self._handleMessage.bind(self));
  });
  this._socket.set('log level', 1);
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
  if (callback) {
    this.once('replyTo:' + id, callback);
  }
  this._sender.emit('message', message);
};

export.Connection = Connection;
