var socketIo = require('socket.io');
var connect = require('connect');
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

        if (typeof handlerOptions.onResponse == 'function')
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
  function createPublishedMessageHandler(messageEvent, commandDefinition) {
    return (function(message) {
      var subscriberIds = message.to;
      if (!Array.isArray(subscriberIds))
        subscriberIds = [subscriberIds];

      var subscribers = allSubscribers[messageEvent] || {};
      subscriberIds.forEach(function(subscriberId) {
        var subscriberSocket = subscribers[subscriberId];
        subscriberSocket = subscriberSocket && subscriberSocket.socket;
        if (!subscriberSocket)
          return;
        try {
          commandDefinition.onPublish(message.body, subscriberSocket);
        } catch(error) {
          subscriberSocket.emit('error', error.message || error);
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
      if (!definition.name)
        definition.name = commandName;
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
    if (definition.messageType)
      connection.on(definition.messageType,
                    createPublishedMessageHandler(definition.messageType,
                                                  definition));
  });

  var io = socketIo.listen(server);

  // share session information with HTTP connections
  var parseCookie = connect.utils.parseCookie;
  var sessionStore = params.sessionStore;
  io.configure(function() {
    io.set('authorization', function(handshakeData, callback) {
      if (handshakeData.headers.cookie) {
        var cookie = handshakeData.headers.cookie;
        var sessionID = parseCookie(cookie)['connect.sid'];
        handshakeData.sessionID = sessionID;
        if (sessionStore) {
          sessionStore.get(sessionID, function(error, session) {
            if (error) {
              callback(error, false);
            } else {
              handshakeData.session =  session;
              callback(null, true);
            }
          });
        } else {
          callback(null, true);
        }
      } else {
        return callback(new Error('no cookie'), false);
      }
    });
  });

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

        var messageEvent = registeredCommand.definition.messageType;
        var subscribers = allSubscribers[messageEvent] || {};
        allSubscribers[messageEvent] = subscribers;

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
      Object.keys(allSubscribers).forEach(function(messageEvent) {
        var subscribers = allSubscribers[messageEvent];
        if (subscribers && subscribers[subscriberId]) {
          subscribers[subscriberId].unsubscribe();
          delete subscribers[subscriberId];
        }
      });
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });

    socket.emit('connected', {
      route:      connection.getRouteToSelf({ sessionId: socket.id }),
      subscriber: subscriberId
    });
  });

  return registeredCommands;
}
