/**
 * fluent-logger-node mod
 *   "reconnect" option
 */

var sender = require('fluent-logger/sender');

var OriginalFluentSender = sender.FluentSender;

function ExtendedFluentSender(tag, options) {
  var sender = new OriginalFluentSender(tag, options);
  sender.reconnect = options.reconnect || false;
  return sender;
}

OriginalFluentSender.prototype._connect = function(callback, reconnecting) {
  var self = this;
  if (self._socket === null) {
    self._socket = new net.Socket();
    self._socket.setTimeout(self.timeout);
    self._socket.on('error', function(err) {
      if (self._socket) {
        self._socket.destroy();
        self._socket = null;
        if (self.reconnect && !reconnecting) {
          self._connect(callback, true);
        } else {
          self._eventEmitter.emit('error', err);
        }
      }
    });
    self._socket.connect(self.port, self.host, function() {
      callback();
    });
  } else {
    process.nextTick(function() {
      callback();
    });
  }
};

sender.FluentSender = ExtendedFluentSender;
