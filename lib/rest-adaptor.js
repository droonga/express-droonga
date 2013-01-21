var Connection = require('./backend-adaptor').Connection;
var builders = require('./builders');

function createRESTHandler(type,
                           requestBuilders,
                           responseBuilders,
                           connection) {
  var requestBuilder = requestBuilders[type];
  if (!requestBuilder)
    throw new Error('no request builder for ' + type);

  var responseBuilder = responseBuilders[type];
  if (!responseBuilder)
    throw new Error('no response builder for ' + type);

  return (function(request, response) {
    var message = requestBuilder(request);
    connection.emitMessage(type, message, function(responseMessage) {
      var body = responseBuilder(responseMessage);
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
      return createRESTHandler(type, builders.requestInREST, builders.response, connection);
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
