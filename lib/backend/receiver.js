var net = require('net');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack');

function MsgPackReceiver(port) {
  this.port = port || undefined;
  this._init();
}

MsgPackReceiver.prototype = new EventEmitter();

MsgPackReceiver.prototype._init = function() {
  this._server = net.createServer(this._onConnect.bind(this));
};

MsgPackReceiver.prototype._onConnect = function(socket) {
  this._socket = socket;
  this._messageStream = new msgpack.Stream(socket);
  this._messageStream.on('msg', this._onMessageReceive.bind(this));
};

MsgPackReceiver.prototype._onMessageReceive = function(data) {
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

MsgPackReceiver.prototype.close = function() {
  if (this._messageStream) {
    this._messageStream = undefined;
  }
  if (this._socket) {
    this._socket.destroy();
    this._socket = undefined;
  }
  if (this._server) {
    this._server.close();
    this._server = undefined;
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

FluentReceiver.prototype = Object.create(MsgPackReceiver.prototype);

FluentReceiver.prototype._onMessageReceive = function(packet) {
  MsgPackReceiver.prototype._onMessageReceive.call(this, packet);
  if (packet.length == 3) { // Message type
    this.emit(packet[0], packet[2]);
  }
  else { // Forward type
    packet[1].forEach(function(entry) {
      this.emit(packet[0], entry[1]);
    }, this);
  }
};

exports.FluentReceiver = FluentReceiver;
