/**
 * var connection = new Connection({ tag:             'droonga',
 *                                   defaultDataset:  'example',
 *                                   hostName:        '127.0.0.1',
 *                                   port:            24224,
 *                                   receiveHostName: '127.0.0.1',
 *                                   receivePort:     10030 });
 */

var EventEmitter = require('events').EventEmitter;
var fluent = require('fluent-logger');
var FluentReceiver = require('./receiver').FluentReceiver;
var util = require('util');
var debug = require('../debug');

var DEFAULT_FLUENT_TAG =
      Connection.DEFAULT_FLUENT_TAG =
        'droonga';
var DEFAULT_FLUENT_HOST_NAME =
      Connection.DEFAULT_FLUENT_HOST_NAME =
        '127.0.0.1';
var DEFAULT_FLUENT_PORT =
      Connection.DEFAULT_FLUENT_PORT =
        24224;
var DEFAULT_RECEIVE_HOST_NAME =
      Connection.DEFAULT_RECEIVE_HOST_NAME =
        '127.0.0.1';

var ERROR_GATEWAY_TIMEOUT =
      Connection.ERROR_GATEWAY_TIMEOUT =
        504;

var DEFAULT_RESPONSE_TIMEOUT =
      Connection.DEFAULT_RESPONSE_TIMEOUT =
        60 * 1000;

function Connection(params) {
  EventEmitter.call(this);
  this._params = params || {};
  this._init();
}

util.inherits(Connection, EventEmitter);

Connection.prototype._init = function() {
  this.closed = false;
  this._callbacks = {};
  this._id = Date.now();
  this.tag = process.env.DROONGA_ENGINE_TAG ||
               this._params.tag ||
                 DEFAULT_FLUENT_TAG;
  this.defaultDataset = process.env.DROONGA_ENGINE_DEFAULT_DATASET ||
                          this._params.defaultDataset ||
                            '';
  this._initSender();
  this._initReceiver();
};

Connection.prototype._initSender = function(wait) {
  this._sendingMessages = {};
  var options = { host: process.env.DROONGA_ENGINE_HOST ||
                          this._params.hostName ||
                            DEFAULT_FLUENT_HOST_NAME,
                  port: process.env.DROONGA_ENGINE_PORT ||
                          this._params.port ||
                            DEFAULT_FLUENT_PORT };
  var sender = fluent.createFluentSender(this.tag, options);
  this._sender = sender;
  this._sender.on('error', (function(error) {
    var errorMessage =
      'An error is occurred in protocol adapter: ' +
      '[' + error.name + '] ' + error.message;
    var ids = Object.keys(this._sendingMessages);
    if (ids.length == 0) {
      console.error(errorMessage, error);
    } else {
      ids.forEach(function(id) {
        var sendingMessage = this._sendingMessages[id];
        var message = {
          inReplyTo: id,
          statusCode: 500,
          type: sendingMessage.type + '.result',
          body: {
            name: 'ProtocolAdapterError',
            message: errorMessage,
            detail: error
          }
        }
        this.emit('reply:' + id, message.statusCode, message);
      }.bind(this));
      this._sendingMessages = {};
    }
  }).bind(this));
};

Connection.prototype._initReceiver = function() {
  this._receiveCount = 0;
  this._sendCount = 0;
  if (!this._receiver) {
    this.receiveHostName = process.env.DROONGA_ENGINE_RECEIVE_HOST ||
                             this._params.receiveHostName ||
                               DEFAULT_RECEIVE_HOST_NAME;
    this.receivePort = process.env.DROONGA_ENGINE_RECEIVE_PORT ||
                         this._params.receivePort;
  } else {
    this._receiver.close();
  }

  var receiver = new FluentReceiver(this.receivePort);
  receiver.listen((function() {
    this.receivePort = receiver.port;
  }).bind(this));

  var tag = this.tag + '.message';
  debug('Connection._initReceiver %d: %d %d:',
        this._id, receiver._id, this.receivePort, tag);
  this._receiver = receiver;
  this._receiver.on(tag,
                    this._handleMessage.bind(this));
};

function isSuccess(code) {
  return Math.floor(code / 100) == 2;
}

Connection.prototype._handleMessage = function(envelope) {
  var inReplyTo = envelope.inReplyTo;
  if (inReplyTo) {
    delete this._sendingMessages[inReplyTo];
    debug('Connection._handleMessage.reply %d:', this._id, inReplyTo);
    var errorCode = envelope.statusCode;
    if (!errorCode || isSuccess(errorCode))
      errorCode = null;
    this.emit('reply:' + inReplyTo, errorCode, envelope);
  } else {
    debug('Connection._handleMessage.message %d:', this._id, envelope.type);
    this.emit(envelope.type, envelope);
  }
};

Connection.prototype.getRouteToSelf = function(options) {
  options = options || {};

  var from = this.receiveHostName + ':' + this.receivePort + '/' +
               this.tag + '?connection_id=' + this._id;
  if (options.sessionId)
    from += '&client_session_id=' + options.sessionId;

  return from;
}

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
  if (!this._sender)
    throw new Error('emitMessage is unexpectedly called after the connection is closed!');

  options = options || {};

  // support emitMessage(type, body, options)
  if (callback && typeof callback != 'function') {
    options = callback;
    callback = null;
  }

  var id = createId();
  debug('Connection.emitMessage %d:', this._id, id, type);
  var from = this.getRouteToSelf(options);
  var envelope = {
    id:         id,
    from:       from,
    date:       getCurrentTime(),
    dataset:    options.dataset || this.defaultDataset,
    type:       type,
    body:       body
  };
  if (callback) {
    envelope.replyTo = from;

    var event = 'reply:' + id;
    var timeoutId;
    this.once(event, function(errorCode, response) {
      debug('Connection.emitMessage.reply %d:', this._id, errorCode);
      clearTimeout(timeoutId);
      callback(errorCode, response);
    });
    options.timeout = toPositiveInteger(options.timeout) ||
                        DEFAULT_RESPONSE_TIMEOUT;
    timeoutId = setTimeout((function() {
      this.removeAllListeners(event);
      callback(ERROR_GATEWAY_TIMEOUT, null);
    }).bind(this), options.timeout);
  }
  this._sendingMessages[id] = {
    type: type
  };
  this._sender.emit('message', envelope, options.emittedCallback);
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
  this.closed = true;
};

exports.Connection = Connection;
