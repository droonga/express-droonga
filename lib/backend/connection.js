/**
 * var connection = new Connection({ tag:             'droonga',
 *                                   hostName:        'localhost',
 *                                   port:            24224,
 *                                   receiveHostName: 'localhost',
 *                                   receivePort:     10030 });
 */

var EventEmitter = require('events').EventEmitter;
var fluent = require('fluent-logger');
var FluentReceiver = require('./receiver').FluentReceiver;

var DEFAULT_FLUENT_TAG =
      Connection.DEFAULT_FLUENT_TAG =
        'droonga';
var DEFAULT_FLUENT_HOST_NAME =
      Connection.DEFAULT_FLUENT_HOST_NAME =
        'localhost';
var DEFAULT_FLUENT_PORT =
      Connection.DEFAULT_FLUENT_PORT =
        24224;
var DEFAULT_RECEIVE_HOST_NAME =
      Connection.DEFAULT_RECEIVE_HOST_NAME =
        'localhost';

var ERROR_GATEWAY_TIMEOUT =
      Connection.ERROR_GATEWAY_TIMEOUT =
        504;

var DEFAULT_RESPONSE_TIMEOUT =
      Connection.DEFAULT_RESPONSE_TIMEOUT =
        60 * 1000;

function Connection(params) {
  this._params = params || {};
  this._init();
}

Connection.prototype = new EventEmitter();

Connection.prototype._init = function() {
  this._callbacks = {};
  this._id = Date.now();
  this.tag = this._params.tag || DEFAULT_FLUENT_TAG;
  this._initSender();
  this._initReceiver();
};

Connection.prototype._initSender = function(wait) {
  var options = { host: this._params.hostName || DEFAULT_FLUENT_HOST_NAME,
                  port: this._params.port || DEFAULT_FLUENT_PORT };
  var sender = fluent.createFluentSender(this.tag, options);
  this._sender = sender;
  this._sender.on('error', (function(error) {
    this.emit('error', error);
  }).bind(this));
};

Connection.prototype._initReceiver = function() {
  this.receiveHostName = this._params.receiveHostName || DEFAULT_RECEIVE_HOST_NAME;
  this.receivePort = this._params.receivePort;

  var receiver = new FluentReceiver(this.receivePort);
  receiver.listen((function() {
    this.receivePort = receiver.port;
  }).bind(this));

  this._receiver = receiver;
  this._receiver.on(this.tag + '.message',
                    this._handleMessage.bind(this));
};

function isSuccess(code) {
  return Math.floor(code / 100) == 2;
}

Connection.prototype._handleMessage = function(envelope) {
  var inReplyTo = envelope.inReplyTo;
  if (inReplyTo) {
    var errorCode = envelope.statusCode;
    if (!errorCode || isSuccess(errorCode))
      errorCode = null;
    this.emit('reply:' + inReplyTo, errorCode, envelope);
  } else {
    this.emit(envelope.type, envelope.body);
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

function toPositiveInteger(number) {
  if (!number)
    return 0;

  var integer = parseInt(number);
  if (isNaN(integer))
    return 0;

  return Math.max(integer, 0);
}

Connection.prototype.emitMessage = function(type, body, callback, options) {
  options = options || {};
  var id = createId();
  var replyTo = this.receiveHostName + ':' + this.receivePort + '/' +
                  this.tag + '?connection_id=' + this._id;
  if (options.sessionId)
    replyTo += '&client_session_id=' + options.sessionId;
  var envelope = {
    id:         id,
    date:       getCurrentTime(),
    replyTo:    replyTo,
    statusCode: 200,
    type:       type,
    body:       body
  };
  if (callback) {
    var event = 'reply:' + id;
    this.once(event, callback);
    options.timeout = toPositiveInteger(options.timeout) ||
                        DEFAULT_RESPONSE_TIMEOUT;
    setTimeout((function() {
      if (this.listeners(event).length) {
        this.removeAllListeners(event);
        callback(ERROR_GATEWAY_TIMEOUT, null);
      }
    }).bind(this), options.timeout);
  }
  this._sender.emit('message', envelope);
  return envelope;
};

Connection.prototype.close = function() {
  this.removeAllListeners();

  if (this._sender && typeof this._sender.end == 'function') {
    this._sender.end();
    this._sender.removeAllListeners();
    delete this._sender;
  }

  if (this._receiver && typeof this._receiver.close == 'function') {
    this._receiver.close();
    this._receiver.removeAllListeners();
    delete this._receiver;
  }
};

exports.Connection = Connection;
