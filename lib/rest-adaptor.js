var Connection = require('./backend-adaptor').Connection;
var restRequestBuilders = require('./rest-request-builder');

function createRESTHandler(type,
                           requestBuilder,
                           connection) {
  if (!requestBuilder)
    throw new Error('no request builder for ' + type);

  return (function(request, response) {
    var message = requestBuilder(request);
    connection.emitMessage(type, message, function(responseMessage) {
      var body = responseMessage.body;
      response.contentType('application/json');
      response.send(body, 200);
    });
  });
}
exports.createRESTHandler = createRESTHandler;

exports.registerHandlers = function(application, params) {
  params = params || {};
  var connection = params.connection || new Connection(params);

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  function createHandler(type) {
    if (params.handlers)
      return params.handlers[type](connection);
    else
      return createRESTHandler(type, restRequestBuilders[type], connection);
  }

//  this.get(prefix + '/status/:target', createHandler('status'));

  application.get(prefix + '/tables/:tableName', createHandler('search'));

//  this.put(prefix + '/tables/:tableName', createHandler('createtable'));
//  this.del(prefix + '/tables/:tableName', createHandler('removetable'));

//  this.put(prefix + '/tables/:tableName/columns/:columnName', createHandler('createcolumn'));
//  this.del(prefix + '/tables/:tableName/columns/:columnName', createHandler('removecolumn'));

//  this.put(prefix + '/tables/:tableName/records/:key', createHandler('loadrecord'));
//  this.post(prefix + '/tables/:tableName/records', createHandler('loadrecords'));
}
