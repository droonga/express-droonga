var debug = require('../../debug');
var model = require('../../model');

function handle(connection, request, response) {
  debug('api.groonga.handle');

  connection.emitMessage(
    request.params.command,
    request.query,
    function(error, envelope) {
      debug('api.groonga.handle.response');
      if (error) {
        debug('api.groonga.handle.response:', error);
        var body = envelope && envelope.body || null;
        response.jsonp(error, body);
      } else {
        debug('api.groonga.handle.success');
        var body = envelope.body;
        response.jsonp(body);
      }
    }
  );
}

exports.register = function(application, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  application.get(prefix + '/d/:command', function(request, response) {
    handle(connection, request, response);
  });
  // TODO: support load by POST
}
