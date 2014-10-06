var command = require('./command');
var wrapper = require('./wrapper');
var api = require('./api');

function createRequestResponseHandler(params) {
  params = params || {};
  var connection = params.connection;
  var commandName = params.name;
  var definition = params.definition;
  var logger = definition.logger;

  return (function(request, response) {
    logger.trace('adapter.http.createRequestResponseHandler.handle');

    var timeout = definition.timeout || null;
    var options = {
      dataset: definition.dataset,
      timeout: timeout
    };
    var callback = function(error, message) {
        logger.trace('adapter.http.createRequestResponseHandler.handle.response');
        if (error) {
          logger.trace('adapter.http.createRequestResponseHandler.handle.response.error:', error);
          var body = message && message.body || null;
          response.jsonp(error, body);
        } else {
          logger.trace('adapter.http.createRequestResponseHandler.handle.response.success');
          var body = message.body;
          if (definition.onResponse) {
            definition.onResponse(body, response);
          } else {
            response.jsonp(200, body);
          }
        }
      }

    var processRequest = function(error) {
      if (error) {
        var errorBody = {
          error: error.message
        };
        if (error.detail)
          errorBody.detail = error.detail;
        response.jsonp(error.code || 500, errorBody);
        return;
      }
      var wrappedConnection = new wrapper.DroongaProtocolConnectionWrapper(connection, callback, options);
      if (definition.onRequest) {
        try {
          definition.onRequest(request, wrappedConnection, response);
        } catch(error) {
          wrappedConnection.destroy();
          response.jsonp(500, { error: error.message });
        }
      } else {
        wrappedConnection.emit(commandName, request.query);
      }
    };
    if (typeof definition.authorize == 'function')
      definition.authorize(processRequest, request);
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
    logger.trace('adapter.http.createGenericHandler.handle');

    var options = {
      dataset: definition.dataset,
      timeout: definition.timeout || null
    };
    var processRequest = function(error) {
      if (error) {
        var errorBody = {
          error: error.message
        };
        if (error.detail)
          errorBody.detail = error.detail;
        response.jsonp(error.code || 500, errorBody);
        return;
      }
      var wrappedConnection = new wrapper.DroongaProtocolConnectionWrapper(connection, options);
      try {
        definition.onHandle(request, response, wrappedConnection);
      } catch(error) {
        wrappedConnection.destroy();
        response.jsonp(500, { error: error.message });
      }
    };
    if (typeof definition.authorize == 'function')
      definition.authorize(processRequest, request);
    else
      processRequest();
  });
}
exports.createGenericHandler = createGenericHandler;

function getRegistrationMethod(method) {
  method = method || 'GET';
  switch (method.toUpperCase()) {
    case 'PUT':    return 'put';
    case 'POST':   return 'post';
    case 'DELETE': return 'delete';
    default:       return 'get';
 }
}
exports.getRegistrationMethod = getRegistrationMethod;

exports.register = function(application, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  var logger = params.logger || console;

  var commandSets = api.normalize(params.plugins);

  var unifiedCommandSet = {};
  commandSets.forEach(function(commandSet) {
    Object.keys(commandSet).forEach(function(commandName) {
      var definition = commandSet[commandName];
      if (!command.HTTPCommand.isInstance(definition))
        return;
      if (!definition.name)
        definition.name = commandName;
      definition.logger = logger;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!command.HTTPCommand.isInstance(definition))
      return;

    var method = getRegistrationMethod(definition.method);

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
    var path;
    if (typeof definition.path == 'string') {
      path = prefix + definition.path;
    } else { // regexp
      var flags = definition.path.ignoreCase ? 'i' : '' ;
      var source = definition.path.source;
      if (source.charAt(0) == '^') {
        path = new RegExp('^' + prefix + source.replace(/^\^/, ''), flags);
      } else {
        path = new RegExp(prefix + source, flags);
      }
    }
    application[method](path, handler);
    registeredCommands.push({ name:       commandName,
                              definition: definition,
                              handler:    handler });
  });

  return registeredCommands;
}
