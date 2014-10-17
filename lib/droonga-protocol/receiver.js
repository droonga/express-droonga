var util = require('util');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack');
var Q = require('q');
var ConsoleLogger = require('../console-logger').ConsoleLogger;

function MsgPackReceiver(port, options) {
  EventEmitter.call(this);
  this.port = port || undefined;
  options = options || {};
  this._logger = options.logger || new ConsoleLogger();
  this._connections = [];
  this._init();
}

util.inherits(MsgPackReceiver, EventEmitter);

MsgPackReceiver.prototype._init = function() {
  this._id = Date.now();
  this._server = net.createServer(this._onConnect.bind(this));
};

MsgPackReceiver.prototype._onConnect = function(socket) {
  var connection = {
    socket:        socket,
    messageStream: new msgpack.Stream(socket)
  };
  connection.messageStream.on('msg', this._onMessageReceive.bind(this));
  this._connections.push(connection);

  socket.on('close', (function() {
    connection.messageStream.removeAllListeners('msg');
    var index = this._connections.indexOf(connection);
    if (index > -1)
      this._connections.splice(index, 1);
  }).bind(this));
};

MsgPackReceiver.prototype._onMessageReceive = function(data) {
  this._logger.debug('MsgPackReceiver._onMessageReceive %d:', this._id);
  this.emit('receive', data);
};

MsgPackReceiver.prototype.listen = function(callback) {
  if (this.port) {
    this._server.listen(this.port, callback);
  } else {
    this._server.listen((function() {
      this.port = this._server.address().port;
      callback();
    }).bind(this));
  }
};

MsgPackReceiver.prototype.close = function(callback) {
  this._connections.forEach(function(connection) {
    connection.socket.end();
   });
  this._connections = [];

  if (this._server) {
    this._server.close(callback);
    this._server = undefined;
  } else if (typeof callback == 'function') {
    callback();
  }
  this.port = undefined;
};

MsgPackReceiver.prototype.thennableClose = function() {
  var closed = false;
  var resolver = undefined;
  this.close(function() {
    closed = true;
    if (typeof resolver == 'function')
      resolver();
  });

  return Q.Promise((function(resolve, reject, notify) {
    if (closed)
      return resolve();

    resolver = resolve;
  }).bind(this));
};

MsgPackReceiver.prototype.thennableOnce = function(event) {
  var fired = false;
  var givenArgs = [];
  var resolver = undefined;
  this.once(event, function() {
    fired = true;
    givenArgs = arguments;
    if (typeof resolver == 'function')
      resolver(givenArgs);
  });

  return Q.Promise((function(resolve, reject, notify) {
    if (fired)
      return resolve(givenArgs);

    resolver = resolve;
  }).bind(this));
};

exports.MsgPackReceiver = MsgPackReceiver;


/**
 * Supports two type packets:
 *   Forward (used by fluent-cat and fluent-plugin-droonga)
 *     [tag, [[time, data], [time,data], ...]]
 *   Message (used by fluent-logger-node)
 *     [tag, time, data]
 */
function FluentReceiver(port, options) {
  MsgPackReceiver.apply(this, arguments);
}

util.inherits(FluentReceiver, MsgPackReceiver);

FluentReceiver.prototype._onMessageReceive = function(packet) {
  MsgPackReceiver.prototype._onMessageReceive.call(this, packet);
  if (packet.length == 3) { // Message type
    var tag = packet[0];
    var response = packet[2];
    this._logger.debug('FluentReceiver._onMessageReceive.message %d', this._id, tag);
    this.emit(tag, response);
  }
  else { // Forward type
    this._logger.debug('FluentReceiver._onMessageReceive.forward %d', this._id, packet);
    packet[1].forEach(function(entry) {
      this.emit(packet[0], entry[1]);
    }, this);
  }
};

exports.FluentReceiver = FluentReceiver;
