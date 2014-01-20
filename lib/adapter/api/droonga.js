var command = require('../command');

module.exports = {
  // XXX dangerous! this must be disabled on public services.
  'droonga': new command.HTTPRequestResponse({
    method:    'POST',
    path:      '/droonga/:messageType',
    onRequest: function(request, connection) {
      var messageType = request.params.messageType;
      var body = '';
      request.on('data', function(chunk) {
        body += chunk;
      });
      request.on('end', function() {
        body = JSON.parse(body);
        body.timeout = body.timeout || 1000;
        body.type = body.type || 'droonga-' + messageType;
        connection.emit(messageType, body);
      });
    }
  }),
  'droonga-streaming:watch': new command.HTTPStreaming({
    dataset:            'Watch',
    path:               '/droonga-streaming/watch',
    method:             'GET',
    subscription:       'watch.subscribe',
    unsubscription:     'watch.unsubscribe',
    messageType:        'watch.publish',
    createSubscription: function(request) {
      return {
        condition: request.query.condition
      };
    },
    translate:          function(message) {
      return message;
    }
  })
};
