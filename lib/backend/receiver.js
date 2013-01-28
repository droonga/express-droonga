var net = require('net');
var EventEmitter = require('events').EventEmitter;
var msgpack = require('msgpack');

function Receiver(port) {
  this.port = port || undefined;
  this._init();
}

Receiver.prototype = new EventEmitter();

Receiver.prototype._init = function() {
  this._server = net.createServer(this._onConnect.bind(this));
};

Receiver.prototype._onConnect = function(socket) {
  var messageStream = new msgpack.Stream(socket);
  messageStream.on('msg', this._onMessageReceive.bind(this));
};

Receiver.prototype._onMessageReceive = function(message) {
  this.emit(message.tag, message.data);
};

Receiver.prototype.listen = function(callback) {
  if (this.port) {
    this._server.listen(this.port, callback);
  } else {
    this._server.listen((function(){
      this.port = this._server.address().port;
      callback();
    }).bind(this));
  }
};

Receiver.prototype.close = function() {
  if (this._server) {
    this._server.close();
    this._server = undefined;
  }
  this.port = undefined;
};

exports.Receiver = Receiver;
