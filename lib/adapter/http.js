var debug = require('../debug');

var command = require('./command');
var restAPI = require('./api/rest');
var groongaAPI = require('./api/groonga');

function createHandler(params) {
  params = params || {};
  var connection = params.connection;
  var commandName = params.name;
  var definition = params.definition;

  if (!definition.requestConverter)
    throw new Error('no filter for the backend: ' + commandName);

  return (function(request, response) {
    debug('adapter.http.createHandler.handle');

    var result = definition.requestConverter(commandName, request);
    var messageType = result[0];
    var body = result[1];
    var timeout = body.timeout || null;
    var options = { timeout: timeout };
    var callback = function(error, envelope) {
        debug('adapter.rest.createHandler.handle.response');
        if (error) {
          debug('adapter.rest.createHandler.handle.response.error:', error);
          var body = envelope && envelope.body || null;
          response.jsonp(body, error);
        } else {
          debug('adapter.rest.createHandler.handle.response.success');
          var body = envelope.body;
          if (definition.responseConverter) {
            var result = definition.responseConverter(commandName, body);
            body = result[1];
          }
          response.jsonp(body, 200);
        }
      }

    connection.emitMessage(
      messageType,
      body,
      callback,
      options
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

  var commandSets = [restAPI, groongaAPI].concat(params.plugins || []);
  var unifiedCommandSet = {};
  commandSets.forEach(function(commandSet) {
    Object.keys(commandSet).forEach(function(commandName) {
      var definition = commandSet[commandName];
      if (!command.HTTPCommand.isInstance(definition))
        return;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!command.HTTPCommand.isInstance(definition))
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

  application.configure('production', function() {
    application.set('json spaces', -1); // disable pretty print
  });

  return registeredCommands;
}