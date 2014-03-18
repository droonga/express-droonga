var debug = require('../debug');
var util = require('util');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack');

function MsgPackReceiver(port) {
  EventEmitter.call(this);
  this.port = port || undefined;
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
  debug('MsgPackReceiver._onMessageReceive %d:', this._id);
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
  } else if (callback) {
    callback();
  }
  this.port = undefined;
};

exports.MsgPackReceiver = MsgPackReceiver;


/**
 * Supports two type packets:
 *   Forward (used by fluent-cat and fluent-plugin-droonga)
 *     [tag, [[time, data], [time,data], ...]]
 *   Message (used by fluent-logger-node)
 *     [tag, time, data]
 */
function FluentReceiver(port) {
  MsgPackReceiver.apply(this, arguments);
}

util.inherits(FluentReceiver, MsgPackReceiver);

FluentReceiver.prototype._onMessageReceive = function(packet) {
  MsgPackReceiver.prototype._onMessageReceive.call(this, packet);
  if (packet.length == 3) { // Message type
    var tag = packet[0];
    var response = packet[2];
    debug('FluentReceiver._onMessageReceive.message %d', this._id, tag);
    this.emit(tag, response);
  }
  else { // Forward type
    debug('FluentReceiver._onMessageReceive.forward %d', this._id, packet);
    packet[1].forEach(function(entry) {
      this.emit(packet[0], entry[1]);
    }, this);
  }
};

exports.FluentReceiver = FluentReceiver;
