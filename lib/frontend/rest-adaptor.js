var defaultCommands = require('./default-commands/rest');

function createHandler(params) {
  params = params || {};
  var connection = params.connection;
  var command = params.command;
  var requestBuilder = params.requestBuilder;

  if (!requestBuilder)
    throw new Error('no request builder for ' + command);

  return (function(request, response) {
    var message = requestBuilder(request);
    var timeout = message.timeout || null;
    connection.emitMessage(
      command,
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

function getRegisterationMethod(method) {
  switch (method.toUpperCase()) {
    case 'GET':    return 'get';
    case 'PUT':    return 'put';
    case 'POST':   return 'post';
    case 'DELETE': return 'del';
    default:
      throw new Error(method + ' is unsppported HTTP method!');
  }
}
exports.getRegisterationMethod = getRegisterationMethod;

exports.register = function(application, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  var commandSets = [defaultCommands].concat(params.plugins || []);
  var unifiedCommandSet = {};
  commandSets.forEach(function(commandSet) {
    if (typeof commandSets == 'string')
      commandSets = require(commandSets);

    Object.keys(commandSets).forEach(function(command) {
      var definition = commandSets[command];
      unifiedCommandSet[command] = definition;
    });
  });

  Object.keys(unifiedCommandSet).forEach(function(command) {
    var definition = unifiedCommandSet[command];
    var method = getRegisterationMethod(definition.method);
    application[method](
      prefix + definition.path,
      createHandler({
        connection:     connection,
        command:        command,
        requestBuilder: definition.requestBuilder
      })
    );
  });
}
