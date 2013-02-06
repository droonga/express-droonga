var defaultCommands = require('./default-commands/rest');

function createHandler(params) {
  params = params || {};
  var connection = params.connection;
  var command = params.command;
  var requestBuilder = params.requestBuilder;
  var responseBuilder = params.responseBuilder;

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
          if (responseBuilder)
            body = responseBuilder(body);
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
  method = method || 'GET';
  switch (method.toUpperCase()) {
    case 'PUT':    return 'put';
    case 'POST':   return 'post';
    case 'DELETE': return 'del';
    default:       return 'get';
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
    if (typeof commandSet == 'string')
      commandSet = require(commandSet);

    Object.keys(commandSet).forEach(function(command) {
      var definition = commandSet[command];
      if (!definition.path) // ignore non-REST command
        return;
      unifiedCommandSet[command] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(command) {
    var definition = unifiedCommandSet[command];
    if (!definition.path) // ignore not a command definition
      return;
    var method = getRegisterationMethod(definition.method);
    var handler = createHandler({
      connection:      connection,
      command:         definition.command || command,
      requestBuilder:  definition.requestBuilder,
      responseBuilder: definition.responseBuilder
    });
    application[method](prefix + definition.path, handler);
    registeredCommands.push({ command:    command,
                              definition: definition,
                              handler:    handler });
  });
  return registeredCommands;
}
