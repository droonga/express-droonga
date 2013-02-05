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
    if (typeof commandSet == 'string')
      commandSet = require(commandSet);

    Object.keys(commandSet).forEach(function(command) {
      var definition = commandSet[command];
      if (!definition.method) return; // ignore non-REST command
      unifiedCommandSet[command] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(command) {
    var definition = unifiedCommandSet[command];
    if (!definition.method) return; // ignore not a command definition
    var method = getRegisterationMethod(definition.method);
    var handler = createHandler({
      connection:      connection,
      command:         command,
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
