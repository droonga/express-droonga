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

function isA(modelInstance, modelType) {
  return (
    modelInstance &&
    modelInstance._modelTypes &&
    modelInstance._modelTypes.indexOf(modelType) > -1
  );
}


function RequestResponse(options) {
  CommandModel.apply(this, arguments);
  this._modelTypes.push(RequestResponse);
}
RequestResponse.prototype = new CommandModel();
expors.RequestResponse = RequestResponse;


function PublishSubscribe(options) {
  CommandModel.apply(this, arguments);
  this._modelTypes.push(PublishSubscribe);
}
PublishSubscribe.prototype = new CommandModel();
expors.PublishSubscribe = PublishSubscribe;



function REST(options) {
  RequestResponse.apply(this, arguments);
  this._modelTypes.push(REST);
}
REST.prototype = new RequestResponse();
Object.defineProperty(REST.prototype, 'path', {
  get: function() { return this._options.path; }
});
Object.defineProperty(REST.prototype, 'method', {
  get: function() { return this._options.method || 'GET'; }
});
expors.REST = REST;



function SocketCommand() {
}
expors.SocketCommand = SocketCommand;


function SocketRequestResponse(options) {
  RequestResponse.apply(this, arguments);
  this._modelTypes.push(SocketCommand);
  this._modelTypes.push(SocketRequestResponse);
}
SocketRequestResponse.prototype = new RequestResponse();
expors.SocketRequestResponse = SocketRequestResponse;


function SocketPublishSubscribe(options) {
  PublishSubscribe.apply(this, arguments);
  this._modelTypes.push(SocketCommand);
  this._modelTypes.push(SocketPublishSubscribe);
}
SocketPublishSubscribe.prototype = new PublishSubscribe();
expors.SocketPublishSubscribe = SocketPublishSubscribe;
