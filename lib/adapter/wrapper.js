function DroongaProtocolConnectionWrapper(connection, callback, options) {
  this._connection = connection;
  this._callback = callback;
  this._options = options;
}
DroongaProtocolConnectionWrapper.prototype = {
  emit: function(event, data) {
    this._conneciton.emitMessage(event, data, this._callback, this._options);
  },
  destroy: function() {
    delete this._connection;
    delete this._callback;
    delete this._options;
  }
};
exports.DroongaProtocolConnectionWrapper = DroongaProtocolConnectionWrapper;


function SocketIOClientSocketWrapper(socket) {
  this._socket = socket;
}
SocketIOClientSocketWrapper.prototype = {
  emit: function(event, data) {
    this._socket.emit(event, data);
  },
  destroy: function() {
    delete this._socket;
  }
};
exports.SocketIOClientSocketWrapper = SocketIOClientSocketWrapper;