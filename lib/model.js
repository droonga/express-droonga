function CommandModel(options) {
  this._options = options || {};
  this._modelTypes = [];
}
CommandModel.prototype = {
  get toBackend() {
    return this._options.toBackend;
  },
  get toClient() {
    return this._options.toClient;
  }
};
CommandModel.isInstance = function(modelInstance) {
  return (
    modelInstance &&
    modelInstance._modelTypes &&
    modelInstance._modelTypes.indexOf(this) > -1
  );
};


function RequestResponse(options) {
  CommandModel.apply(this, arguments);
  this._modelTypes.push(RequestResponse);
}
RequestResponse.prototype = new CommandModel();
RequestResponse.isInstance = CommandModel.isInstance;
exports.RequestResponse = RequestResponse;


function PublishSubscribe(options) {
  CommandModel.apply(this, arguments);
  this._modelTypes.push(PublishSubscribe);
}
PublishSubscribe.prototype = new CommandModel();
PublishSubscribe.isInstance = CommandModel.isInstance;
exports.PublishSubscribe = PublishSubscribe;



function REST(options) {
  RequestResponse.apply(this, arguments);
  this._modelTypes.push(REST);
  // default handler
  this._options.toBackend = this._options.toBackend || function(event, request) {
    return [event, {}];
  };
}
REST.prototype = new RequestResponse();
REST.isInstance = RequestResponse.isInstance;
Object.defineProperty(REST.prototype, 'path', {
  get: function() { return this._options.path; }
});
Object.defineProperty(REST.prototype, 'method', {
  get: function() { return this._options.method || 'GET'; }
});
exports.REST = REST;



function SocketCommand() {
}
SocketCommand.isInstance = CommandModel.isInstance;
exports.SocketCommand = SocketCommand;


function SocketRequestResponse(options) {
  RequestResponse.apply(this, arguments);
  this._modelTypes.push(SocketCommand);
  this._modelTypes.push(SocketRequestResponse);
}
SocketRequestResponse.prototype = new RequestResponse();
SocketRequestResponse.isInstance = RequestResponse.isInstance;
exports.SocketRequestResponse = SocketRequestResponse;


function SocketPublishSubscribe(options) {
  PublishSubscribe.apply(this, arguments);
  this._modelTypes.push(SocketCommand);
  this._modelTypes.push(SocketPublishSubscribe);
}
SocketPublishSubscribe.prototype = new PublishSubscribe();
SocketRequestResponse.isInstance = PublishSubscribe.isInstance;
exports.SocketPublishSubscribe = SocketPublishSubscribe;
