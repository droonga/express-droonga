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

function sanitizeBackendMessage(message) {
  return {
    statusCode: message.statusCode,
    body: deepClone(message.body)
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

  function createClientMessageHandler(commandName, commandDefinition, socket, handlerOptions) {
    handlerOptions = handlerOptions || {};

    var defaultParameters = {};

    var droongaMessageOptions = {
      dataset:   commandDefinition.dataset,
      timeout:   DEFAULT_TIMEOUT,
      sessionId: socket.id
    };

    var requestHandler  = 'onRequest';
    var responseHandler = 'onResponse';
    if (command.PublishSubscribe.isInstance(commandDefinition))  {
      if (/\.subscribe$/.test(commandName)) {
        requestHandler  = 'onSubscribe';
        responseHandler = 'onSubscribed';
      } else if (/\.unsubscribe$/.test(commandName)) {
        requestHandler  = 'onUnsubscribe';
        responseHandler = 'onUnsubscribed';
      }
    }

    return (function(data, clientOptions) {
      clientOptions = clientOptions || {};

      var callback = function(error, message) {
        if (error) {
          socket.emit('error', error);
          return;
        }

        var responseEvent = message.type;
        var responseData = message.body;
        var options = {};
        if (clientOptions.responseEvent) {
          responseEvent = clientOptions.responseEvent;
          options.event = responseEvent;
        }

        if (handlerOptions.onResponse && typeof handlerOptions.onResponse == 'function')
          handlerOptions.onResponse(data, responseData);

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

      var wrappedConnection = new wrapper.DroongaProtocolConnectionWrapper(connection, callback, droongaMessageOptions);
      if (commandDefinition[requestHandler]) {
        try {
          commandDefinition[requestHandler](data, wrappedConnection);
        } catch(error) {
          wrappedConnection.destroy();
          socket.emit('error', error.message || error);
        }
      } else {
        wrappedConnection.emit(commandName, data);
      }
    });
  }

  function createErrorHandler(socket) {
    return (function(error) {
      socket.emit('error', error);
    });
  }

  var allSubscribers = {};
  function createNotificationHandler(notificationEvent, commandDefinition) {
    return (function(message) {
      var subscriberIds = message.to;
      if (!Array.isArray(subscriberIds))
        subscriberIds = [subscriberIds];

      var subscribers = allSubscribers[notificationEvent] || {};
      subscriberIds.forEach(function(subscriberId) {
        var subscriberSocket = subscribers[subscriberId];
        subscriberSocket = subscriberSocket && subscriberSocket.socket;
        if (!subscriberSocket)
          return;
        try {
          if (commandDefinition.onNotify) {
            try {
              commandDefinition.onNotify(message.body, subscriberSocket);
            } catch(error) {
              subscriberSocket.emit('error', error.message || error);
            }
          } else {
            subscriberSocket.emit(notificationEvent, message.body);
          }
        } catch(exception) {
          console.log(exception + '\n' + exception.stack);
        }
      });
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
    if (definition.notification)
      connection.on(definition.notification,
                    createNotificationHandler(definition.notification,
                                              definition));
  });

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var subscriberId = connection.getRouteToSelf({ sessionId: socket.id });
    subscriberId = command.sha1sum(subscriberId);

    registeredCommands.forEach(function(registeredCommand) {
      if (command.PublishSubscribe.isInstance(registeredCommand.definition)) {
        var subscribeEvent = registeredCommand.name + '.subscribe';
        var unsubscribeEvent = registeredCommand.name + '.unsubscribe';

        unifiedCommandSet[subscribeEvent] =
          unifiedCommandSet[unsubscribeEvent] = registeredCommand.definition;

        var notificationEvent = registeredCommand.definition.notification;
        var subscribers = allSubscribers[notificationEvent] || {};
        allSubscribers[notificationEvent] = subscribers;

        var subscribeHandler = createClientMessageHandler(
            subscribeEvent,
            registeredCommand.definition,
            socket,
            {
              onResponse: function(subscribeMessageBody, responseBody) {
                if (!subscribers[subscriberId]) {
                  var subscriber = {
                    socket:      socket,
                    unsubscribe: function() {
                      unsubscribeHandler(unsubscribeEvent, subscribeMessageBody);
                    }
                  };
                  subscribers[subscriberId] = subscriber
                }
              }
            }
        );
        socket.on(subscribeEvent, subscribeHandler);

        var unsubscribeHandler = createClientMessageHandler(
            unsubscribeEvent,
            registeredCommand.definition,
            socket,
            {
              onResponse: function(unsubscribeMessageBody, responseBody) {
                if (subscribers[subscriberId])
                  delete subscribers[subscriberId];
              }
            }
        );
        socket.on(unsubscribeEvent, unsubscribeHandler);
      } else {
        socket.on(registeredCommand.name,
                  createClientMessageHandler(registeredCommand.name,
                                             registeredCommand.definition,
                                             socket));
      }
    });

    var errorHandler = createErrorHandler(socket);
    connection.on('error', errorHandler);

    socket.on('disconnect', function() {
      Object.keys(allSubscribers).forEach(function(notificationEvent) {
        var subscribers = allSubscribers[notificationEvent];
        if (subscribers && subscribers[subscriberId]) {
          subscribers[subscriberId].unsubscribe();
          delete subscribers[subscriberId];
        }
      });
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });

    socket.emit('connected', {
      route:        connection.getRouteToSelf({ sessionId: socket.id }),
      subscriberId: subscriberId
    });
  });

  return registeredCommands;
}
