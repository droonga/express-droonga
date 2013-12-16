var util = require('util');
var crypto = require('crypto');

function Command(options) {
  this._options = options || {};
  this._commandTypes = [];
}
Command.prototype = {
  isInstanceOf: function(commandType) {
    return (
      commandType &&
      this._commandTypes.indexOf(commandType) > -1
    );
  },
  get dataset() {
    return this._options.dataset;
  }
};
Command.isInstance = function(modelInstance) {
  return (
    modelInstance &&
    modelInstance._commandTypes &&
    modelInstance._commandTypes.indexOf(this) > -1
  );
};


function RequestResponse(options) {
  Command.apply(this, arguments);
  this._commandTypes.push(RequestResponse);
}
util.inherits(RequestResponse, Command);
Object.defineProperty(RequestResponse.prototype, 'onRequest', {
  get: function() { return this._options.onRequest; }
});
Object.defineProperty(RequestResponse.prototype, 'onResponse', {
  get: function() { return this._options.onResponse; }
});
RequestResponse.isInstance = Command.isInstance;
exports.RequestResponse = RequestResponse;


function PublishSubscribe(options) {
  Command.apply(this, arguments);
  this._commandTypes.push(PublishSubscribe);
}
util.inherits(PublishSubscribe, Command);
Object.defineProperty(PublishSubscribe.prototype, 'onSubscribe', {
  get: function() { return this._options.onSubscribe; }
});
Object.defineProperty(PublishSubscribe.prototype, 'onSubscribed', {
  get: function() { return this._options.onSubscribed; }
});
Object.defineProperty(PublishSubscribe.prototype, 'onUnsubscribe', {
  get: function() { return this._options.onUnsubscribe; }
});
Object.defineProperty(PublishSubscribe.prototype, 'onUnsubscribed', {
  get: function() { return this._options.onUnsubscribed; }
});
Object.defineProperty(PublishSubscribe.prototype, 'notification', {
  get: function() { return this._options.notification; }
});
Object.defineProperty(PublishSubscribe.prototype, 'onNotify', {
  get: function() { return this._options.onNotify; }
});
PublishSubscribe.isInstance = Command.isInstance;
exports.PublishSubscribe = PublishSubscribe;



function HTTPCommand(options) {
  Command.apply(this, arguments);
  this._commandTypes.push(HTTPCommand);
}
util.inherits(HTTPCommand, Command);
HTTPCommand.isInstance = Command.isInstance;
Object.defineProperty(HTTPCommand.prototype, 'path', {
  get: function() { return this._options.path; }
});
Object.defineProperty(HTTPCommand.prototype, 'method', {
  get: function() { return this._options.method || 'GET'; }
});
Object.defineProperty(HTTPCommand.prototype, 'onHandle', {
  get: function() { return this._options.onHandle; }
});
exports.HTTPCommand = HTTPCommand;



function HTTPRequestResponse(options) {
  HTTPCommand.apply(this, arguments);
  this._commandTypes.push(HTTPRequestResponse);
  this._commandTypes.push(RequestResponse);
}
util.inherits(HTTPRequestResponse, HTTPCommand);
util.inherits(HTTPRequestResponse, RequestResponse);
HTTPRequestResponse.isInstance = HTTPCommand.isInstance;
exports.HTTPRequestResponse = HTTPRequestResponse;



function SocketCommand() {
}
SocketCommand.isInstance = Command.isInstance;
exports.SocketCommand = SocketCommand;


function SocketRequestResponse(options) {
  RequestResponse.apply(this, arguments);
  this._commandTypes.push(SocketCommand);
  this._commandTypes.push(SocketRequestResponse);
}
util.inherits(SocketRequestResponse, RequestResponse);
SocketRequestResponse.isInstance = RequestResponse.isInstance;
exports.SocketRequestResponse = SocketRequestResponse;


function SocketPublishSubscribe(options) {
  PublishSubscribe.apply(this, arguments);
  this._commandTypes.push(SocketCommand);
  this._commandTypes.push(SocketPublishSubscribe);
}
util.inherits(SocketPublishSubscribe, PublishSubscribe);
SocketRequestResponse.isInstance = PublishSubscribe.isInstance;
exports.SocketPublishSubscribe = SocketPublishSubscribe;


function sha1sum(source) {
  var hash = crypto.createHash('sha1');
  hash = hash.update(source);
  return hash.digest('hex');
}
exports.sha1sum = sha1sum;
