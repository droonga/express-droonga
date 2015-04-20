var command = require('../command');

function pathToMessageType(path) {
  return path
           .split('?')[0]
           .replace(/\/+$/, '')
           .replace(/\/+/g, '.');
}

module.exports = {
  'droonga-get': new command.HTTPRequestResponse({
    method:    'GET',
    path:      /^\/droonga\/(.+)/,
    onRequest: function(request, connection) {
      var messageType = pathToMessageType(request.params[0]);
      var body = {};
      var options = {
        timeout: body.timeout
      };
      if (typeof options.timeout != 'number' &&
          typeof request.query.timeout == 'number')
        options.timeout = request.query.timeout;
      connection.emit(messageType, body, options);
    }
  }),
  // XXX dangerous! this must be disabled on public services.
  'droonga-post': new command.HTTPRequestResponse({
    method:    'POST',
    path:      /^\/droonga\/(.+)/,
    onRequest: function(request, connection) {
      var messageType = pathToMessageType(request.params[0]);
      var body = '';
      request.on('data', function(chunk) {
        body += chunk;
      });
      request.on('end', function() {
        body = JSON.parse(body);
        var options = {
          timeout: body.timeout
        };
        if (typeof options.timeout != 'number' &&
            typeof request.query.timeout == 'number')
          options.timeout = request.query.timeout;
        body.type = body.type || 'droonga-' + messageType;
        connection.emit(messageType, body, options);
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
