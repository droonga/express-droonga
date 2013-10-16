var socketIo = require('socket.io');
var command = require('./command');
var wrapper = require('./wrapper');
var api = require('./api');

var DEFAULT_TIMEOUT = 10 * 1000;

function deepClone(base) {
  if (!base || typeof base != 'object')
    return base;

  var cloned = Object.create(null);
  Object.keys(base).forEach(function(key) {
    cloned[key] = deepClone(base[key]);
  });
  return cloned;
}

function sanitizeBackendMessage(envelope) {
  return {
    statusCode: envelope.statusCode,
    body: deepClone(envelope.body)
  };
}
exports.sanitizeBackendMessage = sanitizeBackendMessage;

exports.register = function(application, server, params) {
  params = params || {};
  var connection = params.connection;
  if (!connection)
    throw new Error('Connection to the backend is required!');

  if (!server)
    throw new Error('A server instance is required!');

  function createClientMessageHandler(commandName, socket, onResponseCallback) {
    return (function(data, clientOptions) {
      var commandDefinition = unifiedCommandSet[commandName];
      if (!commandDefinition)
        return;

      clientOptions = clientOptions || {};

      var event = commandName;

      var requestHandler  = 'onRequest';
      var responseHandler = 'onResponse';

      if (command.PublishSubscribe.isInstance(commandDefinition))  {
        if (/\.subscribe$/.test(commandName)) {
          requestHandler  = 'onSubscribe';
          responseHandler = 'onSubscribeResponse';
        } else if (/\.unsubscribe$/.test(commandName)) {
          requestHandler  = 'onUnsubscribe';
          responseHandler = 'onUnsubscribeResponse';
        }
      }

      var options = {
        dataset:   commandDefinition.dataset,
        timeout:   DEFAULT_TIMEOUT,
        sessionId: socket.id
      };
      var callback = function(error, envelope) {
        if (error) {
          socket.emit('error', error);
          return;
        }

        var responseEvent = envelope.type;
        var responseData = envelope.body;
        var options = {};
        if (clientOptions.responseEvent) {
          responseEvent = clientOptions.responseEvent;
          options.event = responseEvent;
        }

        if (onResponseCallback && typeof onResponseCallback == 'function')
          onResponseCallback();

        var wrappedSocket = new wrapper.SocketIOClientSocketWrapper(socket, options);
        if (commandDefinition[responseHandler]) {
          try {
            commandDefinition[responseHandler](responseData, wrappedSocket);
          } catch(error) {
            wrappedSocket.emit('error', error.message || error);
          }
        } else {
          wrappedSocket.emit(responseEvent, responseData);
          wrappedSocket.destroy();
        }
      };

      var wrappedConection = new wrapper.DroongaProtocolConnectionWrapper(connection, callback, options);
      if (commandDefinition[requestHandler]) {
        try {
          commandDefinition[requestHandler](data, wrappedConection);
        } catch(error) {
          wrappedConection.destroy();
          socket.emit('error', error.message || error);
        }
      } else {
        wrappedConection.emit(event, data);
      }
    });
  }

  function createNotificationHandler(commandName, socket) {
    return (function(body) {
      var commandDefinition = unifiedCommandSet[commandName];

      var event = commandName;
      var data = body;

      var wrappedSocket = new wrapper.SocketIOClientSocketWrapper(socket);
      if (commandDefinition.onNotify) {
        try {
          commandDefinition.onNotify(data, wrappedSocket);
        } catch(error) {
          wrappedSocket.emit('error', error.message || error);
        }
      } else {
        wrappedSocket.emit(event, data);
        wrappedSocket.destroy();
      }
    });
  }

  function createErrorHandler(socket) {
    return (function(error) {
      socket.emit('error', error);
    });
  }

  var commandSets = api.normalize(params.plugins);
  
  var unifiedCommandSet = {};
  commandSets.forEach(function(commandSet) {
    Object.keys(commandSet).forEach(function(commandName) {
      var definition = commandSet[commandName];
      if (!command.SocketCommand.isInstance(definition))
        return;
      unifiedCommandSet[commandName] = definition;
    });
  });

  var registeredCommands = [];
  Object.keys(unifiedCommandSet).forEach(function(commandName) {
    var definition = unifiedCommandSet[commandName];
    if (!command.SocketCommand.isInstance(definition))
      return;
    registeredCommands.push({ name:       commandName,
                              definition: definition });
  });

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var events = [];
    var handlers = {};
    registeredCommands.forEach(function(registeredCommand) {
      if (command.PublishSubscribe.isInstance(registeredCommand.definition)) {
        var subscribeEvent = registeredCommand.name + '.subscribe';
        var unsubscribeEvent = registeredCommand.name + '.unsubscribe';
        var notificationEvent = registeredCommand.name + '.notification';
        var notificationHandler = createNotificationHandler(notificationEvent, socket);

        socket.on(subscribeEvent,
                  createClientMessageHandler(subscribeEvent, socket, function() {
                    if (handlers[notificationEvent])
                      return;
                    connection.on(notificationEvent, notificationHandler);
                    handlers[notificationEvent] = notificationHandler;
                  }));
        socket.on(unsubscribeEvent,
                  createClientMessageHandler(unsubscribeEvent, socket, function() {
                    if (!handlers[notificationEvent])
                      return;
                    connection.removeListener(notificationEvent, notificationHandler);
                    delete handlers[notificationEvent];
                  }));

        unifiedCommandSet[subscribeEvent] = registeredCommand.definition;
        unifiedCommandSet[unsubscribeEvent] = registeredCommand.definition;
        unifiedCommandSet[notificationEvent] = registeredCommand.definition;

        events.push(notificationEvent);
      } else {
        socket.on(registeredCommand.name,
                  createClientMessageHandler(registeredCommand.name, socket));
      }
    });

    var errorHandler = createErrorHandler(socket);
    connection.on('error', errorHandler);

    socket.on('disconnect', function() {
      events.forEach(function(event) {
        if (handlers[event])
          connection.removeListener(event, handlers[event]);
      });
      events = undefined;
      handlers = undefined;
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });
  });

  return registeredCommands;
}
