var util = require('util');

function Command(options) {
  this._options = options || {};
  this._commandTypes = [];
}
Command.prototype = {
  get requestConverter() {
    return this._options.requestConverter;
  },
  get responseConverter() {
    return this._options.responseConverter;
  },
  isInstanceOf: function(commandType) {
    return (
      commandType &&
      this._commandTypes.indexOf(commandType) > -1
    );
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
RequestResponse.isInstance = Command.isInstance;
exports.RequestResponse = RequestResponse;


function PublishSubscribe(options) {
  Command.apply(this, arguments);
  this._commandTypes.push(PublishSubscribe);
}
util.inherits(PublishSubscribe, Command);
PublishSubscribe.isInstance = Command.isInstance;
exports.PublishSubscribe = PublishSubscribe;



function HTTPCommand(options) {
  RequestResponse.apply(this, arguments);
  this._commandTypes.push(HTTPCommand);
  // default handler
  this._options.requestConverter = this._options.requestConverter || function(event, request) {
    return [event, {}];
  };
}
util.inherits(HTTPCommand, RequestResponse);
HTTPCommand.isInstance = RequestResponse.isInstance;
Object.defineProperty(HTTPCommand.prototype, 'path', {
  get: function() { return this._options.path; }
});
Object.defineProperty(HTTPCommand.prototype, 'method', {
  get: function() { return this._options.method || 'GET'; }
});
exports.HTTPCommand = HTTPCommand;



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
