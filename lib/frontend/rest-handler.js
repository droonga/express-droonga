var restRequestBuilders = require('./rest-request-builder');

function createHandler(type,
                       requestBuilder,
                       connection) {
  if (!requestBuilder)
    throw new Error('no request builder for ' + type);

  return (function(request, response) {
    var message = requestBuilder(request);
    var timeout = message.timeout || null;
    connection.emitMessage(
      type,
      message,
      function(error, responseMessage) {
        if (error) {
          var body = responseMessage && responseMessage.body || null;
          response.contentType('application/json');
          response.send(body, error);
        } else {
          var body = responseMessage.body;
          response.contentType('application/json');
          response.send(body, 200);
        }
      },
      { timeout: timeout }
    );
  });
}
exports.createHandler = createHandler;

exports.register = function(application, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  function createHandlerFor(type) {
    if (params.handlers)
      return params.handlers[type](connection);
    else
      return createHandler(type, restRequestBuilders[type], connection);
  }

//  this.get(prefix + '/status/:target', createHandlerFor('status'));

  application.get(prefix + '/tables/:tableName', createHandlerFor('search'));

//  this.put(prefix + '/tables/:tableName', createHandlerFor('createtable'));
//  this.del(prefix + '/tables/:tableName', createHandlerFor('removetable'));

//  this.put(prefix + '/tables/:tableName/columns/:columnName', createHandlerFor('createcolumn'));
//  this.del(prefix + '/tables/:tableName/columns/:columnName', createHandlerFor('removecolumn'));

//  this.put(prefix + '/tables/:tableName/records/:key', createHandlerFor('loadrecord'));
//  this.post(prefix + '/tables/:tableName/records', createHandlerFor('loadrecords'));
}
