function DroongaProtocolConnectionWrapper(connection, callback, options) {
  this._connection = connection;
  this._callback = callback;
  this._options = options;
}
DroongaProtocolConnectionWrapper.prototype = {
  emit: function(event, data, callback) {
    if (callback) {
      var originalCallback = callback;
      callback = function(error, response) {
        originalCallback(error, response.body);
      };
    } else {
      callback = this._callback;
    }
    this._connection.emitMessage(event, data, callback, this._options);
  },
  destroy: function() {
    delete this._connection;
    delete this._callback;
    delete this._options;
  }
};
exports.DroongaProtocolConnectionWrapper = DroongaProtocolConnectionWrapper;


function SocketIOClientSocketWrapper(socket, options) {
  this._socket = socket;
  this._options = options || {};
}
SocketIOClientSocketWrapper.prototype = {
  emit: function(event, data) {
    if (this._options.event)
      event = this._options.event;
    this._socket.emit(event, data);
  },
  destroy: function() {
    delete this._socket;
  }
};
exports.SocketIOClientSocketWrapper = SocketIOClientSocketWrapper;
