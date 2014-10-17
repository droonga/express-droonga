var utils = require('../../../test-utils');

var successMessage = {
  statusCode: 200,
  body:       true
};
exports.successMessage = successMessage;

function pushSuccessResponse(backend) {
  backend.reserveResponse(function(requestPacket) {
    return utils.createReplyPacket(requestPacket, successMessage);
  });
}
exports.pushSuccessResponse = pushSuccessResponse;

function groongaResponse(responseMessage) {
  if (typeof responseMessage.body == 'string')
    return JSON.parse(responseMessage.body);
  else
    return responseMessage.body;
}
exports.groongaResponse = groongaResponse;

function groongaResponseHeader(responseMessage) {
  return groongaResponse(responseMessage)[0];
};
exports.groongaResponseHeader = groongaResponseHeader;

function groongaResponseBody(responseMessage) {
  return groongaResponse(responseMessage)[1];
};
exports.groongaResponseBody = groongaResponseBody;
