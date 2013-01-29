/**
 * fluent-logger-node mod
 *   "reconnect" option
 */

var net = require('net');
var sender = require('fluent-logger/lib/sender');

var OriginalFluentSender = sender.FluentSender;

function ExtendedFluentSender(tag, options) {
  options = options || {};
  var sender = new OriginalFluentSender(tag, options);
  sender.maxRetryCount = options.maxRetryCount || 0;
  sender.retryDelay = options.retryDelay || 1000;
  return sender;
}

OriginalFluentSender.prototype.emit = function(label, data, callback, retryCount){
  var self = this;
  var item = self._makePacketItem(label, data);
  item.callback = callback;
  self._sendQueue.push(item);
  self._sendQueueTail++;
  self._connect(
    function() {
      self._flushSendQueue();
    },
    function() {
      retryCount = retryCount || 0;
      if (self.maxRetryCount && retryCount < self.maxRetryCount) {
        setTimeout(function() {
          self.emit(label, data, callback, retryCount + 1);
        }, self.retryDelay);
        return true;
      } else {
        return false;
      }
    }
  );
};

OriginalFluentSender.prototype._connect = function(successCallback, retryCallback) {
  var self = this;
  if (self._socket === null) {
    self._socket = new net.Socket();
    self._socket.setTimeout(self.timeout);
    self._socket.on('error', function(err) {
      if (self._socket) {
        self._socket.destroy();
        self._socket = null;
        if (!retryCallback || !retryCallback()) {
          self._eventEmitter.emit('error', err);
        }
      }
    });
    self._socket.connect(self.port, self.host, function() {
      successCallback();
    });
  } else {
    process.nextTick(function() {
      successCallback();
    });
  }
};

sender.FluentSender = ExtendedFluentSender;
