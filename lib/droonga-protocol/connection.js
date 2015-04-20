/**
 * var connection = new Connection({ tag:             'droonga',
 *                                   defaultDataset:  'example',
 *                                   hostName:        '127.0.0.1',
 *                                   port:            24224,
 *                                   receiveHostName: '127.0.0.1',
 *                                   receivePort:     10030 });
 */

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fluent = require('fluent-logger');
var Q = require('q');
var microtime = require('microtime');

var FluentReceiver = require('./receiver').FluentReceiver;
var ConsoleLogger = require('../console-logger').ConsoleLogger;

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

var ERROR_SERVICE_UNAVAILABLE =
      Connection.ERROR_SERVICE_UNAVAILABLE =
        503;

var ERROR_GATEWAY_TIMEOUT =
      Connection.ERROR_GATEWAY_TIMEOUT =
        504;

var ONE_SECOND_IN_MILLISECONDS = 1000;

var DEFAULT_RESPONSE_TIMEOUT_SECONDS =
      Connection.DEFAULT_RESPONSE_TIMEOUT_SECONDS =
        60;

function Connection(params) {
  EventEmitter.call(this);
  this._params = params || {};
  this._logger = this._params.logger || new ConsoleLogger();
  this._init();
}

util.inherits(Connection, EventEmitter);

Connection.prototype._init = function() {
  this.closed = false;
  this._pendingMessages = [];
  this._id = Date.now();
  this.tag = process.env.DROONGA_ENGINE_TAG ||
               this._params.tag ||
                 DEFAULT_FLUENT_TAG;
  this.defaultDataset = process.env.DROONGA_ENGINE_DEFAULT_DATASET ||
                          this._params.defaultDataset ||
                            '';
  this.defaultTimeout = this._params.defaultTimeout ||
                          null;
  this.hostName = this._params.hostName ||
                          process.env.DROONGA_ENGINE_HOST ||
                            DEFAULT_FLUENT_HOST_NAME;
  this.port = process.env.DROONGA_ENGINE_PORT ||
                          this._params.port ||
                            DEFAULT_FLUENT_PORT;
  this.hostAndPort = this.hostName + ':' + this.port;
  this._initSender();
  this._initReceiver();
};

Connection.prototype._initSender = function(wait) {
  this._sendingMessages = {};
  var options = { host: this.hostName,
                  port: this.port };
  var sender = fluent.createFluentSender(this.tag, options);
  this._sender = sender;
  this._sender.on('error', (function(error) {
    var errorMessage =
      'An error is occurred in protocol adapter: ' +
      '[' + error.name + '] ' + error.message;
    var ids = Object.keys(this._sendingMessages);
    if (ids.length == 0) {
      this._logger.error(errorMessage, error);
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

  var receiver = new FluentReceiver(this.receivePort,
                                    { logger: this._logger });
  receiver.listen((function() {
    this.receivePort = receiver.port;
    this._sendPendingMessages();
  }).bind(this));

  var tag = this.tag + '.message';
  this._logger.trace('Connection._initReceiver %d (%s): %d %d:',
                     this._id, this.hostAndPort,
                     receiver._id, this.receivePort, tag);
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
    this._logger.trace('Connection._handleMessage.reply %d (%s):',
                       this._id, this.hostAndPort, envelope);
    var errorCode = envelope.statusCode;
    if (!errorCode || isSuccess(errorCode))
      errorCode = null;
    this.emit('reply:' + inReplyTo, errorCode, envelope);
  } else {
    this._logger.trace('Connection._handleMessage.message %d (%s):',
                       this._id, this.hostAndPort, envelope);
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
  // The method toISOString() returns a GMT (ex. 2013-01-10T08:34:41.252123Z)
  // on node. However, a local time (ex. 2013-01-10T17:34:41.252123+09:00) is
  // more helpful for debugging. We should use it in the feature...

  // We should use microseconds instead milliseconds, because droonga-engine
  // need to detect the order of messages more strictly.
  var nowStruct = microtime.nowStruct();
  var seconds = nowStruct[0];
  var microseconds = nowStruct[1];

  var date = new Date((seconds * 1000) + (microseconds / 1000));
  var isoString = date.toISOString();
  var subsecondsPart = ('000000' + microseconds).substr(-6);
  var isoStringWithMicroseconds = isoString.replace(/\.\d+Z$/, '.' + subsecondsPart + 'Z');
  return isoStringWithMicroseconds;
}

function toFloat(number) {
  if (!number)
    return 0;

  var float = parseFloat(number);
  if (isNaN(float))
    return 0;

  return float;
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

  if (!this.receivePort) {
    this._logger.trace('Connection.emitMessage %d (%s): ' +
                         'Receiver is not initialized yet. ' +
                         'Given message will be sent later.',
                       this._id, this.hostAndPort);
    this._pendingMessages.push([type, body, callback, options]);
    return null;
  }

  var id = createId();
  this._logger.trace('Connection.emitMessage %d (%s):',
                     this._id, this.hostAndPort);
  var from = this.getRouteToSelf(options);
  var envelope = {
    id:         id,
    from:       from,
    date:       getCurrentTime(),
    dataset:    options.dataset || this.defaultDataset,
    type:       type,
    body:       body
  };
  if (typeof options.timeout == 'number')
    envelope.timeout = options.timeout;
  else if (typeof this.defaultTimeout == 'number')
    envelope.timeout = this.defaultTimeout;

  this._logger.trace('emitMessage: trying to send message: ',
                     envelope);

  var sendingMessages = { type: type };
  if (callback) {
    sendingMessages.callback = callback;
    envelope.replyTo = from;

    var event = 'reply:' + id;
    var timeoutId;
    this.once(event, (function(errorCode, response) {
      this._logger.trace('Connection.emitMessage.reply %d (%s):',
                         this._id, this.hostAndPort, errorCode);
      if (timeoutId)
        clearTimeout(timeoutId);
      if (sendingMessages)
        sendingMessages.callback = null;
      if (!callback)
        return;
      try {
        callback(errorCode, response);
        callback = null;
      }
      catch(error) {
        this._logger.error(error);
      }
    }).bind(this));

    if (typeof options.timeout == 'number') {
      options.timeout = toFloat(options.timeout)
    }
    else {
      options.timeout = DEFAULT_RESPONSE_TIMEOUT_SECONDS;
    }
    if (options.timeout > -1) {
      var timeoutMilliseconds = options.timeout * ONE_SECOND_IN_MILLISECONDS;
      timeoutId = setTimeout((function() {
        this._logger.trace('Connection timed out (message id: '+id+')');
        this.removeAllListeners(event);
        if (sendingMessages)
          sendingMessages.callback = null;
        if (!callback)
          return;
        try {
          callback(ERROR_GATEWAY_TIMEOUT, null);
          callback = null;
        }
        catch(error) {
          this._logger.error(error);
        }
      }).bind(this), timeoutMilliseconds);
    }
  }
  this._sendingMessages[id] = sendingMessages;
  this._sender.emit('message', envelope, options.emittedCallback);
  return envelope;
};

Connection.prototype.thenableEmitMessage = function(type, body, options) {
  return Q.Promise((function(resolve, reject, notify) {
    this.emitMessage(type, body, function(errorCode, response) {
      resolve({ errorCode: errorCode, response: response });
    }, options);
  }).bind(this));
};

Connection.prototype._sendPendingMessages = function() {
  this._logger.trace('Connection._sendPendingMessages %d (%s): ' +
                       'Send %d pending message(s).',
                     this._id, this.hostAndPort,
                     this._pendingMessages.length);
  if (this._pendingMessages.length) {
    this._pendingMessages.forEach(function(args) {
      this.emitMessage.apply(this, args);
    }, this);
    this._pendingMessages = [];
  }
};

Connection.prototype.close = function() {
  this.removeAllListeners();

  Object.keys(this._sendingMessages).forEach(function(id) {
    var message = this._sendingMessages[id];
    var callback = message.callback;
    if (typeof callback == 'function') {
      try {
        callback(ERROR_SERVICE_UNAVAILABLE, null);
        message.callback = callback = null;
      }
      catch(error) {
        this._logger.error(error)
      }
    }
  }, this);
  this._sendingMessages = {};

  if (this._sender && typeof this._sender.end == 'function') {
    try {
      this._sender.end();
      this._sender.removeAllListeners();
    }
    catch(error) {
    }
    delete this._sender;
  }

  if (this._receiver && typeof this._receiver.close == 'function') {
    try {
      this._receiver.close();
      this._receiver.removeAllListeners();
    }
    catch(error) {
    }
    delete this._receiver;
  }
  this.closed = true;
};

Connection.prototype.getStatus = function() {
  var status = {};
  status.pendingMessages = this._pendingMessages.map(function(pendingMessage) {
    return {
      type:    pendingMessage[0],
      body:    pendingMessage[1],
      options: pendingMessage[3]
    };
  });
  status.sendingMessages = {};
  Object.keys(this._sendingMessages).forEach(function(id) {
    status.sendingMessages[id] = this._sendingMessages[id];
  }, this);
  return status;
};

exports.Connection = Connection;
