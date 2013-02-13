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
    'reqrep-mod-event': new model.SocketRequestResponse({
      toBackend: function(event, data) { return [event + '.mod', data]; },
      toClient: function(event, data) { return [event + '.mod', data]; }
    }),
    'reqrep-mod-body': new model.SocketRequestResponse({
      toBackend: function(event, data) { return [event, 'modified request']; },
      toClient: function(event, data) { return [event, 'modified response']; }
    }),
    'pubsub-mod-event': new model.SocketPublishSubscribe({
      toBackend: function(event, data) { return [event + '.mod', data]; },
      toClient: function(event, data) { return [event + '.mod', data]; }
    }),
    'pubsub-mod-body': new model.SocketPublishSubscribe({
      toBackend: function(event, data) { return [event, 'modified request']; },
      toClient: function(event, data) { return [event, 'modified response']; }
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

  function setupApplication() {
    var application = express();
    return utils
      .setupServer(application)
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
          tag:      'test',
          connection: connection,
          plugins: [testPlugin]
        });
        return application;
      });
  }

  function getBackendReceivedMessages() {
    return backend.received.map(function(packet) {
      return packet[2];
    });
  }

  function getBackendReceivedEvents() {
    return getBackendReceivedMessages().map(function(message) {
      return message.type;
    });
  }

  function getBackendReceivedBodies() {
    return getBackendReceivedMessages().map(function(message) {
      return message.body;
    });
  }

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
            .takes('pubsub.subscribe', messages[0], null, {})
          .mock('emitMessage')
            .takes('pubsub.subscribe', messages[1], null, {})
          .mock('emitMessage')
            .takes('pubsub.subscribe', messages[2], null, {})
          .mock('emitMessage')
            .takes('pubsub.subscribe', messages[3], null, {})
          .mock('emitMessage')
            .takes('pubsub.subscribe', messages[4], null, {})
          .mock('emitMessage')
            .takes('pubsub.subscribe', messages[5], null, {});

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

  suite('toBackend/toClient filter', function() {
    suite('request-response', function() {
      function testReqRep(description, params) {
        test(description, function(done) {
          var mockedReceiver;
          setupApplication()
            .createClientSocket()
            .next(function(newClientSocket) {
              clientSockets.push(newClientSocket);
              clientSockets[0].emit(params.clientCommand, params.clientBody);
            })
            .wait(0.01)
            .next(function() {
              assert.deepEqual(getBackendReceivedMessages().map(function(message) {
                                 return { type: message.type,
                                          body: message.body };
                               }),
                               [{ type: params.expectedClientCommand,
                                  body: params.expectedClientBody }]);

              mockedReceiver = nodemock
                .mock('receive')
                  .takes(params.expectedBackendBody);
              clientSockets[0].on(params.expectedBackendCommand, function(data) {
                mockedReceiver.receive(data);
              });

              var request = getBackendReceivedMessages()[0];
              var response = utils.createReplyEnvelope(request,
                                                       params.backendCommand,
                                                       params.backendBody);
              return utils.sendPacketTo(utils.createPacket(response),
                                        utils.testReceivePort)
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
      }

      testReqRep('modified event type', {
        clientCommand:          'reqrep-mod-event',
        clientBody:             'raw request',
        expectedClientCommand:  'reqrep-mod-event.mod',
        expectedClientBody:     'raw request',
        backendCommand:         'reqrep-mod-event.response',
        backendBody:            'raw response',
        expectedBackendCommand: 'reqrep-mod-event.mod.response',
        expectedBackendBody:    'raw response'        
      });

      testReqRep('modified body', {
        clientCommand:          'reqrep-mod-body',
        clientBody:             'raw request',
        expectedClientCommand:  'reqrep-mod-body',
        expectedClientBody:     'modified request',
        backendCommand:         'reqrep-mod-body.response',
        backendBody:            'raw response',
        expectedBackendCommand: 'reqrep-mod-body.response',
        expectedBackendBody:    'modified response'        
      });
    });

    suite('publish-subscribe', function() {
      function testPubSub(description, params) {
        test(description, function(done) {
          var mockedReceiver;
          setupApplication()
            .createClientSocket()
            .next(function(newClientSocket) {
              clientSockets.push(newClientSocket);
              clientSockets[0].emit(params.clientCommand, params.clientBody);
            })
            .wait(0.01)
            .next(function() {
              assert.deepEqual(getBackendReceivedMessages().map(function(message) {
                                 return { type: message.type,
                                          body: message.body };
                               }),
                               [{ type: params.expectedClientCommand,
                                  body: params.expectedClientBody }]);

              mockedReceiver = nodemock
                .mock('receive')
                  .takes(params.expectedBackendBody);
              clientSockets[0].on(params.expectedBackendCommand, function(data) {
                mockedReceiver.receive(data);
              });

              var published = utils.createEnvelope(params.backendCommand,
                                                   params.backendBody);
              return utils.sendPacketTo(utils.createPacket(published),
                                        utils.testReceivePort)
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
      }

      testPubSub('modified event type', {
        clientCommand:          'pubsub-mod-event.subscribe',
        clientBody:             'raw request',
        expectedClientCommand:  'pubsub-mod-event.mod.subscribe',
        expectedClientBody:     'raw request',
        backendCommand:         'pubsub-mod-event',
        backendBody:            'raw response',
        expectedBackendCommand: 'pubsub-mod-event.mod',
        expectedBackendBody:    'raw response'        
      });

      testPubSub('modified body', {
        clientCommand:          'pubsub-mod-body.subscribe',
        clientBody:             'raw request',
        expectedClientCommand:  'pubsub-mod-body.subscribe',
        expectedClientBody:     'modified request',
        backendCommand:         'pubsub-mod-body',
        backendBody:            'raw response',
        expectedBackendCommand: 'pubsub-mod-body',
        expectedBackendBody:    'modified response'        
      });
    });
  });
});

