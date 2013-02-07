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
exports.isA = isA;


function RequestResponse(options) {
  CommandModel.apply(this, arguments);
  this._modelTypes.push(RequestResponse);
}
RequestResponse.prototype = new CommandModel();
exports.RequestResponse = RequestResponse;


function PublishSubscribe(options) {
  CommandModel.apply(this, arguments);
  this._modelTypes.push(PublishSubscribe);
}
PublishSubscribe.prototype = new CommandModel();
exports.PublishSubscribe = PublishSubscribe;



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
exports.REST = REST;



function SocketCommand() {
}
exports.SocketCommand = SocketCommand;


function SocketRequestResponse(options) {
  RequestResponse.apply(this, arguments);
  this._modelTypes.push(SocketCommand);
  this._modelTypes.push(SocketRequestResponse);
}
SocketRequestResponse.prototype = new RequestResponse();
exports.SocketRequestResponse = SocketRequestResponse;


function SocketPublishSubscribe(options) {
  PublishSubscribe.apply(this, arguments);
  this._modelTypes.push(SocketCommand);
  this._modelTypes.push(SocketPublishSubscribe);
}
SocketPublishSubscribe.prototype = new PublishSubscribe();
exports.SocketPublishSubscribe = SocketPublishSubscribe;
