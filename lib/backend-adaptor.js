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
  this._initSender();
  this._initReceiver();
};

Connection.prototype._initSender = function() {
  this._sender = (
    this._params.sender ||
    fluent.createFluentSender(this._params.tag || DEFAULT_FLUENT_TAG,
                              { host: this._params.host || DEFAULT_FLUENT_HOST,
                                port: this._params.port || DEFAULT_FLUENT_PORT })
  );
};

Connection.prototype._initReceiver = function() {
  this._receiver = (
    this._params.receiver ||
    socketIo.listen(this._params.listenPort || DEFAULT_LISTEN_PORT)
  );

  this._receiver.sockets.on(
    'connection',
    (function(socket) {
      socket.on((this._params.tag || DEFAULT_FLUENT_TAG)+ '.message',
                this._handleMessage.bind(this));
    }).bind(this)
  );
  this._receiver.set('log level', 1);
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

function getCurrentTime() {
  // The method toISOString() returns a GMT (ex. 2013-01-10T08:34:41.252Z)
  // on node. However, a local time (ex. 2013-01-10T17:34:41.252+09:00) is
  // more helpful for debugging. We should use it in the feature...
  return new Date().toISOString();
}

Connection.prototype.emitMessage = function(body, callback) {
  var id = createId();
  var envelope = {
    id:         id,
    date:       getCurrentTime(),
    statusCode: 200,
    body:       body
  };
  if (callback) {
    this.once('replyTo:' + id, callback);
  }
  this._sender.emit('message', envelope);
  return envelope;
};

exports.Connection = Connection;
