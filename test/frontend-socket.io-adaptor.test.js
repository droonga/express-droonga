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
  var backend;

  var testPlugin = {
    'request-response': new model.SocketRequestResponse(),
    'pubsub': new model.SocketPublishSubscribe(),
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
    if (backend) {
      backend.close();
      backend = undefined;
    }
    if (connection) {
      if (typeof connection.close == 'function') { // real connection
        connection.close();
      } else { // mocked connection
        utils.readyToDestroyMockedConnection(connection, clientSockets.length);
      }
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
        return utils.createClientSockets(3);
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
            .takes('pubsub', messages[0], null, {})
          .mock('emitMessage')
            .takes('pubsub', messages[1], null, {})
          .mock('emitMessage')
            .takes('pubsub', messages[2], null, {})
          .mock('emitMessage')
            .takes('pubsub', messages[3], null, {})
          .mock('emitMessage')
            .takes('pubsub', messages[4], null, {})
          .mock('emitMessage')
            .takes('pubsub', messages[5], null, {});

        clientSockets[0].emit('pubsub', messages[0]);
        clientSockets[1].emit('pubsub', messages[1]);
        clientSockets[2].emit('pubsub', messages[2]);
        clientSockets[0].emit('pubsub', messages[3]);
        clientSockets[1].emit('pubsub', messages[4]);
        clientSockets[2].emit('pubsub', messages[5]);
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

  test('one way, back to front', function(done) {
    var messages = [
      Math.random(),
      Math.random()
    ];
    var clientReceiver = nodemock
          .mock('receive').takes('0' + messages[0])
          .mock('receive').takes('1' + messages[0])
          .mock('receive').takes('2' + messages[0])
          .mock('receive').takes('0' + messages[1])
          .mock('receive').takes('1' + messages[1])
          .mock('receive').takes('2' + messages[1]);
    var packets = messages.map(function(message) {
      var envelope = utils.createEnvelope('pubsub', message);
      return utils.createPacket(envelope);
    });

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
      })
      .createBackend()
      .next(function(newBackend) {
        backend = newBackend;
        connection = new Connection({
          tag:      'test',
          hostName: 'localhost',
          port:     utils.testSendPort,
          receivePort: utils.testReceivePort,
          maxRetyrCount: 3,
          retryDelay: 1
        });
        socketIoAdaptor.register(application, server, {
          tag: 'test',
          connection: connection,
          plugins: [testPlugin]
        });
        return utils.createClientSockets(3);
      })
      .next(function(newClientSockets) {
        clientSockets = clientSockets.concat(newClientSockets);

        clientSockets[0].on('pubsub', function(data) {
          clientReceiver.receive('0' + data);
        });
        clientSockets[1].on('pubsub', function(data) {
          clientReceiver.receive('1' + data);
        });
        clientSockets[2].on('pubsub', function(data) {
          clientReceiver.receive('2' + data);
        });
      })
      .sendPacketTo(packets[0], utils.testReceivePort)
      .wait(0.01)
      .sendPacketTo(packets[1], utils.testReceivePort)
      .wait(0.01)
      .next(function() {
        clientReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style message', function(done) {
    var messages = [
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random()
    ];
    var clientReceiver;

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
      })
      .createBackend()
      .next(function(newBackend) {
        backend = newBackend;
        connection = new Connection({
          tag:      'test',
          hostName: 'localhost',
          port:     utils.testSendPort,
          receivePort: utils.testReceivePort,
          maxRetyrCount: 3,
          retryDelay: 1
        });
        socketIoAdaptor.register(application, server, {
          tag: 'test',
          connection: connection,
          plugins: [testPlugin]
        });
        return utils.createClientSockets(3);
      })
      .next(function(newClientSockets) {
        clientSockets = clientSockets.concat(newClientSockets);

        clientSockets[0].emit('request-response', messages[0]);
      })
      .wait(0.01)
      .next(function() {
        clientSockets[1].emit('request-response', messages[1]);
      })
      .wait(0.01)
      .next(function() {
        clientSockets[2].emit('request-response', messages[2]);
      })
      .wait(0.01)
      .next(function() {
        clientSockets[0].emit('request-response', messages[3]);
      })
      .wait(0.01)
      .next(function() {
        clientSockets[1].emit('request-response', messages[4]);
      })
      .wait(0.01)
      .next(function() {
        clientSockets[2].emit('request-response', messages[5]);
      })
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 6);
        assert.deepEqual([backend.received[0][2].body,
                          backend.received[1][2].body,
                          backend.received[2][2].body,
                          backend.received[3][2].body,
                          backend.received[4][2].body,
                          backend.received[5][2].body],
                         messages);

        var responses = backend.received.map(function(receivedPacket) {
          var original = receivedPacket[2];
          return utils.createReplyEnvelopeFor(original, 'request-response', Math.random());
        });

        clientReceiver = nodemock
          .mock('receive').takes(0, responses[0].body)
          .mock('receive').takes(1, responses[1].body)
          .mock('receive').takes(2, responses[2].body)
          .mock('receive').takes(0, responses[3].body)
          .mock('receive').takes(1, responses[4].body)
          .mock('receive').takes(2, responses[5].body);
        clientSockets[0].on('request-response', function(data) {
          clientReceiver.receive(0, data);
        });
        clientSockets[1].on('request-response', function(data) {
          clientReceiver.receive(1, data);
        });
        clientSockets[2].on('request-response', function(data) {
          clientReceiver.receive(2, data);
        });

        return utils
          .sendPacketTo(utils.createPacket(responses[0]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[1]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[2]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[3]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[4]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[5]), utils.testReceivePort);
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
        clientSockets[0].on('builder', function(data) {
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

