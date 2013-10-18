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

        if (handlerOptions.onResponse && typeof handlerOptions.onResponse == 'function')
          handlerOptions.onResponse();

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

  function createNotificationHandler(commandName, commandDefinition, socket) {
    return (function(body) {
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

  // "watch" command defined in api/socket.io.js
  var watchSubscribers = {};
  var watchNotificationHandler = function(envelope) {
    var subscribers = envelope.to;
    if (!Array.isArray(subscribers))
      subscribers = [subscribers];
    subscribers.forEach(function(subscriber) {
      subscriber = watchSubscribers[subscriber];
      if (subscriber)
        subscriber.emit('watch.notification', envelope.body);
    });
  };
  connection.on('watch.notification', watchNotificationHandler);

  var io = socketIo.listen(server);
  io.sockets.on('connection', function(socket) {
    application.emit('connection', socket);

    var watchSubscriber = connection.getRouteToSelf({ sessionId: socket.id });
    watchSubscriber = command.sha1sum(watchSubscriber);

    registeredCommands.forEach(function(registeredCommand) {
      if (command.PublishSubscribe.isInstance(registeredCommand.definition)) {
        var subscribeEvent = registeredCommand.name + '.subscribe';
        var unsubscribeEvent = registeredCommand.name + '.unsubscribe';

        unifiedCommandSet[subscribeEvent] =
          unifiedCommandSet[unsubscribeEvent] = registeredCommand.definition;

        socket.on(
          subscribeEvent,
          createClientMessageHandler(
            subscribeEvent,
            registeredCommand.definition,
            socket,
            {
              onResponse: function() {
                if (!watchSubscribers[watchSubscriber])
                  watchSubscribers[watchSubscriber] = socket;
              }
            }
          )
        );

        socket.on(
          unsubscribeEvent,
          createClientMessageHandler(
            unsubscribeEvent,
            registeredCommand.definition,
            socket,
            {
              onResponse: function() {
                if (watchSubscribers[watchSubscriber])
                  delete watchSubscribers[watchSubscriber];
              }
            }
          )
        );
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
      delete watchSubscribers[watchSubscriber];
      connection.removeListener('error', errorHandler);
      socket.removeAllListeners();
    });
  });

  return registeredCommands;
}
