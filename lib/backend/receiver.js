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
    this._server.listen((function(){
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


function Receiver(port) {
  MsgPackReceiver.apply(this, arguments);
}

Receiver.prototype = Object.create(MsgPackReceiver.prototype);

Receiver.prototype._onMessageReceive = function(message) {
  this.emit(message.tag, message.data);
};

exports.Receiver = Receiver;
