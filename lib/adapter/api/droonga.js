var command = require('../command');
var requestBuilders = require('./rest-request-builder');

module.exports = {
  // XXX dangerous! this must be disabled on public services.
  'droonga': new command.HTTPCommand({
    method: 'POST',
    path: '/droonga/:messageType',
    onRequest: function(request, connection) {
      var messageType = request.params.messageType;

      var body = request.body;
      it (typeof body == 'string')
        body = JSON.parse(body);

      body.timeout = body.timeout || 1000;
      body.type = body.type || 'droonga-' + messageType;

      connection.emit(messageType, body);
    }
  })
};
