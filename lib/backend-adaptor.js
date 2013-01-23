/**
 * var connection = new Connection({ tag:             'groonga',
 *                                   hostName:        'localhost',
 *                                   port:            24224,
 *                                   receiveHostName: 'localhost',
 *                                   receivePort:     10030 });
 * or
 * var server = require('http').createServer(handler);
 * server.listen(10030);
 * var connection = new Connection({ tag:             'groonga',
 *                                   hostName:        'localhost',
 *                                   port:            24224,
 *                                   receiveHostName: 'localhost',
 *                                   receiveServer:   server });
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

var DEFAULT_FLUENT_TAG        = 'groonga';
var DEFAULT_FLUENT_HOST_NAME  = 'localhost';
var DEFAULT_FLUENT_PORT       = 24224;
var DEFAULT_RECEIVE_HOST_NAME = 'localhost';
var DEFAULT_RECEIVE_PORT      = 10030;

var ERROR_GATEWAY_TIMEOUT = exports.ERROR_GATEWAY_TIMEOUT = 504;

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
                              { host: this._params.hostName || DEFAULT_FLUENT_HOST_NAME,
                                port: this._params.port || DEFAULT_FLUENT_PORT })
  );
};

Connection.prototype._initReceiver = function() {
  this.receiveHostName = this._params.receiveHostName || DEFAULT_RECEIVE_HOST_NAME;
  this.receivePort = this._params.receivePort || DEFAULT_RECEIVE_PORT;

  var receiver = this._params.receiver;
  if (!receiver) {
    var server = this.receiveServer;
    if (!server) {
      server = require('http').createServer(function() {});
      server.listen(this.receivePort);
    }
    receiver = socketIo.listen(server);
  }

  this._receiver = receiver;

  this._receiver.sockets.on(
    'connection',
    (function(socket) {
      socket.on((this._params.tag || DEFAULT_FLUENT_TAG)+ '.message',
                this._handleMessage.bind(this));
    }).bind(this)
  );
  this._receiver.set('log level', 1);
};

function isSuccess(code) {
  return Math.floor(code / 100) == 2;
}

Connection.prototype._handleMessage = function(envelope) {
  this.emit('message', envelope);

  var inReplyTo = envelope['inReplyTo'];
  if (inReplyTo) {
    var errorCode = envelope.statusCode;
    if (!errorCode || isSuccess(errorCode))
      errorCode = null;
    this.emit('inReplyTo:' + inReplyTo, errorCode, envelope);
  }
};

var count = 0;
function createId() {
  return Date.now() + ':' + (count++);
}

function getCurrentTime() {
  // The method toISOString() returns a GMT (ex. 2013-01-10T08:34:41.252Z)
  // on node. However, a local time (ex. 2013-01-10T17:34:41.252+09:00) is
  // more helpful for debugging. We should use it in the feature...
  return new Date().toISOString();
}

Connection.prototype.emitMessage = function(type, body, callback, timeout) {
  var id = createId();
  var envelope = {
    id:         id,
    date:       getCurrentTime(),
    replyTo:    this.receiveHostName + ':' + this.receivePort,
    statusCode: 200,
    type:       type,
    body:       body
  };
  if (callback) {
    var event = 'inReplyTo:' + id;
    this.once(event, callback);
    if (timeout) {
      setTimeout((function() {
        if (this.listeners(event)) {
          this.removeAllListeners(event);
          callback(ERROR_GATEWAY_TIMEOUT, null);
        }
      }).bind(this), timeout);
    }
  }
  this._sender.emit('message', envelope);
  return envelope;
};

exports.Connection = Connection;
