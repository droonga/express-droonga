var debug = require('../debug');

var command = require('./command');
var wrapper = require('./wrapper');
var api = require('./api');

function createRequestResponseHandler(params) {
  params = params || {};
  var connection = params.connection;
  var commandName = params.name;
  var definition = params.definition;

  return (function(request, response) {
    debug('adapter.http.createRequestResponseHandler.handle');

    var timeout = definition.timeout || null;
    var options = {
      dataset: definition.dataset,
      timeout: timeout
    };
    var callback = function(error, message) {
        debug('adapter.http.createRequestResponseHandler.handle.response');
        if (error) {
          debug('adapter.http.createRequestResponseHandler.handle.response.error:', error);
          var body = message && message.body || null;
          response.jsonp(body, error);
        } else {
          debug('adapter.http.createRequestResponseHandler.handle.response.success');
          var body = message.body;
          if (definition.onResponse) {
            definition.onResponse(body, response);
          } else {
            response.jsonp(body, 200);
          }
        }
      }

    var processRequest = function(request, response) {
      var wrappedConnection = new wrapper.DroongaProtocolConnectionWrapper(connection, callback, options);
      if (definition.onRequest) {
        try {
          definition.onRequest(request, wrappedConnection, response);
        } catch(error) {
          wrappedConnection.destroy();
          response.jsonp(error, 500);
        }
      } else {
        wrappedConnection.emit(commandName, request.query);
      }
    };
    if (typeof definition.authorize == 'function')
      definition.authorize(processRequest, request, response);
    else
      processRequest();
  });
}
exports.createRequestResponseHandler = createRequestResponseHandler;

function createGenericHandler(params) {
  params = params || {};
  var connection = params.connection;
  var commandName = params.name;
  var definition = params.definition;

  return (function(request, response) {
    debug('adapter.http.createGenericHandler.handle');

    var options = {
      dataset: definition.dataset,
      timeout: definition.timeout || null
    };
    var processRequest = function(request, response) {
      var wrappedConnection = new wrapper.DroongaProtocolConnectionWrapper(connection, options);
      try {
        definition.onHandle(request, response, wrappedConnection);
      } catch(error) {
        wrappedConnection.destroy();
        response.jsonp(error, 500);
      }
    };
    if (typeof definition.authorize == 'function')
      definition.authorize(processRequest, request, response);
    else
      processRequest();
  });
}
exports.createGenericHandler = createGenericHandler;

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

  var commandSets = api.normalize(params.plugins);

  var unifiedCommandSet = {};
  commandSets.forEach(function(commandSet) {
    Object.keys(commandSet).forEach(function(commandName) {
      var definition = commandSet[commandName];
      if (!command.HTTPCommand.isInstance(definition))
        return;
      if (!definition.name)
        definition.name = commandName;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!command.HTTPCommand.isInstance(definition))
      return;

    var method = getRegisterationMethod(definition.method);

    var creator;
    if (command.RequestResponse.isInstance(definition)) {
      creator = createRequestResponseHandler;
    } else {
      definition.onHandle; // try to get it. if it is undefined, the definition raises error.
      creator = createGenericHandler;
    }

    var handler = creator({
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
