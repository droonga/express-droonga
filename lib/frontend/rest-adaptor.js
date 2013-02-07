var model = require('../model');
var defaultCommands = require('./default-commands/rest');

function createHandler(params) {
  params = params || {};
  var connection = params.connection;
  var commandName = params.name;
  var definition = params.definition;

  if (!definition.toBackend)
    throw new Error('no filter for the backend: ' + commandName);

  return (function(request, response) {
    var result = definition.toBackend(commandName, request);
    var messageType = result[0];
    var body = result[1];
    var timeout = message.timeout || null;
    connection.emitMessage(
      messageType,
      body,
      function(error, responseMessage) {
        if (error) {
          var body = responseMessage && responseMessage.body || null;
          response.contentType('application/json');
          response.send(body, error);
        } else {
          var body = responseMessage.body;
          if (definition.toClient) {
            var result = definition.toClient(commandName, body);
            body = result[1];
          }
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
    Object.keys(commandSet).forEach(function(commandName) {
      var definition = commandSet[commandName];
      if (!model.isA(definition, model.REST))
        return;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!model.isA(definition, model.REST))
      return;
    var method = getRegisterationMethod(definition.method);
    var handler = createHandler({
      connection:  connection,
      name:        definition.command || commandName,
      definition:  definition
    });
    application[method](prefix + definition.path, handler);
    registeredCommands.push({ name:       commandName,
                              definition: definition,
                              handler:    handler });
  });
  return registeredCommands;
}
