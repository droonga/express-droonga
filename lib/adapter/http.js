var debug = require('../debug');

var command = require('./command');
var wrapper = require('./wrapper');
var restAPI = require('./api/rest');
var droongaAPI = require('./api/droonga');
var groongaAPI = require('./api/groonga');

function createHandler(params) {
  params = params || {};
  var connection = params.connection;
  var commandName = params.name;
  var definition = params.definition;

  return (function(request, response) {
    debug('adapter.http.createHandler.handle');

    var timeout = definition.timeout || null;
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
          if (definition.onResponse) {
            definition.onResponse(body, response);
          } else {
            response.jsonp(body, 200);
          }
        }
      }

    var wrappedConnection = new wrapper.DroongaProtocolConnectionWrapper(connection, callback, options);
    if (definition.onRequest) {
      try {
        definition.onRequest(request, wrappedConnection);
      } catch(error) {
        wrappedConnection.destroy();
        response.jsonp(error, 500);
      }
    } else {
      wrappedConnection.emit(commandName, request.query);
    }
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

  var commandSets = [restAPI, droongaAPI, groongaAPI].concat(params.plugins || []);
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
