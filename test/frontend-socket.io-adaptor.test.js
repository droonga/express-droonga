var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var socketIoAdaptor = require('../lib/frontend/socket.io-adaptor');
var model = require('../lib/model');
var scoketIoCommands = require('../lib/frontend/default-commands/socket.io');
var Connection = require('../lib/backend/connection').Connection;

suite('Socket.IO API', function() {
  var connection;
  var server;
  var clientSockets;

  var testPlugin = {
    'request-response': new model.SocketRequestResponse(),
    'publish-subscribe': new model.SocketPublishSubscribe(),
    'foobar': new model.SocketPublishSubscribe(),
    'builder': new model.SocketPublishSubscribe({
      toBackend: function(event, data) { return [event, 'builder request']; },
      toClient: function(event, data) { return [event, 'builder response'] }
    }),
    'customevent': new model.SocketPublishSubscribe({
      toBackend: function(event, data) { return ['custom', data] },
      toClient: function(event, data) { return ['custom', 'custom response']; }
    })
  };

  setup(function() {
    clientSockets = [];
  });

  teardown(function() {
    if (connection) {
      utils.readyToDestroyMockedConnection(connection, clientSockets.length);
      connection = undefined;
    }
    if (clientSockets.length) {
      clientSockets.forEach(function(clientSocket) {
        clientSocket.disconnect();
      });
    }
    if (server) {
      server.close();
      server = undefined;
    }
  });

  test('registeration of plugin commands', function(done) {
    var basePlugin = {
      getCommand: new model.SocketRequestResponse(),
      putCommand: new model.SocketRequestResponse(),
      postCommand: new model.SocketRequestResponse(),
      deleteCommand: new model.SocketRequestResponse(),
      ignored: new model.REST()
    };
    var overridingPlugin = {
      postCommand: new model.SocketRequestResponse(),
      deleteCommand: new model.SocketRequestResponse()
    };

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;

        var registeredCommands = socketIoAdaptor.register(application, server, {
          connection: utils.createStubbedBackendConnection(),
          plugins: [
            basePlugin,
            overridingPlugin
          ]
        });

        registeredCommands = registeredCommands.map(function(command) {
          return {
            name:       command.name,
            definition: command.definition
          };
        });
        assert.deepEqual(registeredCommands,
                         [{ name:       'search',
                            definition: scoketIoCommands.search },
                          { name:       'getCommand',
                            definition: basePlugin.getCommand },
                          { name:       'putCommand',
                            definition: basePlugin.putCommand },
                          { name:       'postCommand',
                            definition: overridingPlugin.postCommand },
                          { name:       'deleteCommand',
                            definition: overridingPlugin.deleteCommand }]);
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  function createEnvelope(type, body) {
    var now = new Date();
    var envelope = {
      id:         now.getTime(),
      date:       now.toISOString(),
      replyTo:    'localhost:' + utils.testReceivePort,
      statusCode: 200,
      type:       type,
      body:       body
    };
    return envelope;
  }

  test('initialization', function(done) {
    var mockedListener = nodemock
      .mock('connected');

    var application = express();
    application.on('connection', function(socket) {
      mockedListener.connected();
    });

    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: utils.createStubbedBackendConnection(),
          plugins: [testPlugin]
        });

        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSockets.push(newClientSocket);
      })
      .wait(0.01)
      .next(function() {
        mockedListener.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('one way, front to back', function(done) {
    connection = utils.createMockedBackendConnection(testPlugin, 3);

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [testPlugin]
        });
        return Deferred.parallel(
          utils.createClientSocket(),
          utils.createClientSocket(),
          utils.createClientSocket()
        );
      })
      .next(function(newClientSockets) {
        clientSockets = clientSockets.concat(newClientSockets);
        connection.assertThrows();

        var messages = [
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random()
        ];
        connection = connection
          .mock('emitMessage')
            .takes('publish-subscribe', messages[0], null, {})
          .mock('emitMessage')
            .takes('publish-subscribe', messages[1], null, {})
          .mock('emitMessage')
            .takes('publish-subscribe', messages[2], null, {})
          .mock('emitMessage')
            .takes('publish-subscribe', messages[3], null, {})
          .mock('emitMessage')
            .takes('publish-subscribe', messages[4], null, {})
          .mock('emitMessage')
            .takes('publish-subscribe', messages[5], null, {});

        clientSockets[0].emit('publish-subscribe', messages[0]);
        clientSockets[1].emit('publish-subscribe', messages[1]);
        clientSockets[2].emit('publish-subscribe', messages[2]);
        clientSockets[0].emit('publish-subscribe', messages[3]);
        clientSockets[1].emit('publish-subscribe', messages[4]);
        clientSockets[2].emit('publish-subscribe', messages[5]);
      })
      .wait(0.01)
      .next(function() {
        connection.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('one way: single client, back to front', function(done) {
    connection = utils.createMockedBackendConnection(testPlugin);

    var messages = [
      Math.random(),
      Math.random(),
      Math.random()
    ];
    var clientReceiver = nodemock
          .mock('receive')
            .takes(messages[0])
          .mock('receive')
            .takes(messages[1])
          .mock('receive')
            .takes(messages[2]);

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [testPlugin]
        });
        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSockets.push(newClientSocket);
        connection.assertThrows();

        clientSockets[0].on('publish-subscribe', function(data) {
          clientReceiver.receive(data);
        });

        connection.controllers['publish-subscribe']
          .trigger(createEnvelope('publish-subscribe', messages[0]));
        connection.controllers['publish-subscribe']
          .trigger(createEnvelope('publish-subscribe', messages[1]));
        connection.controllers['publish-subscribe']
          .trigger(createEnvelope('publish-subscribe', messages[2]));
      })
      .wait(0.01)
      .next(function() {
        clientReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style message: single client', function(done) {
    connection = utils.createMockedBackendConnection(testPlugin);
    var onReceived = [{}, {}, {}];
    var messages = [
      Math.random(),
      Math.random(),
      Math.random()
    ];
    var clientReceiver;

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [testPlugin]
        });
        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSockets.push(newClientSocket);
        connection.assertThrows();

        connection = connection
          .mock('emitMessage')
            .takes('request-response', messages[0], function() {}, {})
            .ctrl(2, onReceived[0])
          .mock('emitMessage')
            .takes('request-response', messages[1], function() {}, {})
            .ctrl(2, onReceived[1])
          .mock('emitMessage')
            .takes('request-response', messages[2], function() {}, {})
            .ctrl(2, onReceived[2]);

        clientSockets[0].emit('request-response', messages[0]);
        clientSockets[0].emit('request-response', messages[1]);
        clientSockets[0].emit('request-response', messages[2]);
      })
      .wait(0.01)
      .next(function() {
        connection.assertThrows();

        clientReceiver = nodemock
          .mock('receive')
            .takes(messages[0])
          .mock('receive')
            .takes(messages[1])
          .mock('receive')
            .takes(messages[2]);
        clientSockets[0].on('request-response', function(data) {
          clientReceiver.receive(data);
        });

        onReceived[0].trigger(null,
                              createEnvelope('request-response', messages[0]));
        onReceived[1].trigger(null,
                              createEnvelope('request-response', messages[1]));
        onReceived[2].trigger(null,
                              createEnvelope('request-response', messages[2]));
      })
      .wait(0.01)
      .next(function() {
        clientReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('front to back, extra command (without builder)', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection(testPlugin);

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [testPlugin]
        });

        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSockets.push(newClientSocket);
        connection.assertThrows();

        var message = Math.random();
        connection = connection
          .mock('emitMessage')
            .takes('foobar', message, null, {});
        clientSockets[0].emit('foobar', message);
      })
      .wait(0.01)
      .next(function() {
        connection.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('front to back, extra command (with builder)', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection(testPlugin);

    var mockedReceiver = nodemock
          .mock('receive')
            .takes('builder response');

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [testPlugin]
        });
        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSockets.push(newClientSocket);
        connection.assertThrows();

        connection = connection
          .mock('emitMessage')
            .takes('builder', 'builder request', null, {});
        clientSockets[0].on('builder.result', function(data) {
          mockedReceiver.receive(data);
        });
        clientSockets[0].emit('builder', { requestMessage: true });
      })
      .wait(0.01)
      .next(function() {
        connection.assertThrows();
        connection.controllers.builder.trigger({
          statusCode: 200,
          type: 'builder.result',
          body: { responseMessage: true }
        });
      })
      .wait(0.01)
      .next(function() {
        mockedReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('front to back, extra command (custom event name)', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection(testPlugin);

    var mockedReceiver = nodemock
          .mock('receive')
            .takes('custom response');

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [testPlugin]
        });
        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSockets.push(newClientSocket);
        connection.assertThrows();

        connection = connection
          .mock('emitMessage')
            .takes('custom', { requestMessage: true }, null, {});
        clientSockets[0].on('custom', function(data) {
          mockedReceiver.receive(data);
        });
        clientSockets[0].emit('customevent', { requestMessage: true });
      })
      .wait(0.01)
      .next(function() {
        connection.assertThrows();
        connection.controllers.customevent.trigger({
          statusCode: 200,
          type: 'customevent.result',
          body: { responseMessage: true }
        });
      })
      .wait(0.01)
      .next(function() {
        mockedReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

