var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var socketIoAdaptor = require('../lib/frontend/socket.io-adaptor');
var model = require('../lib/model');
var scoketIoCommands = require('../lib/frontend/default-commands/socket.io');

suite('Socket.IO API', function() {
  var connection;
  var server;
  var clientSockets;
  var backend;

  var testPlugin = {
    'reqrep': new model.SocketRequestResponse(),
    'reqrep-mod-event': new model.SocketRequestResponse({
      toBackend: function(event, data) { return [event + '.mod', data]; },
      toClient: function(event, data) { return [event + '.mod', data]; }
    }),
    'reqrep-mod-body': new model.SocketRequestResponse({
      toBackend: function(event, data) { return [event, 'modified request']; },
      toClient: function(event, data) { return [event, 'modified response']; }
    }),
    'pubsub': new model.SocketPublishSubscribe(),
    'pubsub-mod-event': new model.SocketPublishSubscribe({
      toBackend: function(event, data) { return [event + '.mod', data]; },
      toClient: function(event, data) { return [event + '.mod', data]; }
    }),
    'pubsub-mod-body': new model.SocketPublishSubscribe({
      toBackend: function(event, data) { return [event, 'modified request']; },
      toClient: function(event, data) { return [event, 'modified response']; }
    })
  };

  setup(function() {
    clientSockets = [];
  });

  teardown(function() {
    if (clientSockets.length) {
      clientSockets.forEach(function(clientSocket) {
        clientSocket.disconnect();
      });
    }
    utils.teardownApplication({ backend:    backend,
                                server:     server,
                                connection: connection });
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

  suite('request-response', function() {
    function testReqRep(description, params) {
      test(description, function(done) {
        var mockedReceiver;
        utils.setupApplication()
          .next(function(result) {
            server     = result.server;
            connection = result.connection;
            backend    = result.backend;
            socketIoAdaptor.register(result.application, server, {
              tag:      'test',
              connection: connection,
              plugins: [testPlugin]
            });
          })
          .createClientSocket()
          .next(function(newClientSocket) {
            clientSockets.push(newClientSocket);
            clientSockets[0].emit(params.clientCommand, params.clientBody);
          })
          .wait(0.01)
          .next(function() {
            backend.assertReceived([{ type: params.expectedClientCommand,
                                      body: params.expectedClientBody }]);

            mockedReceiver = nodemock
              .mock('receive')
                .takes(params.expectedBackendBody);
            clientSockets[0].on(params.expectedBackendCommand, function(data) {
              mockedReceiver.receive(data);
            });

            var request = backend.getMessages()[0];
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

    testReqRep('basic', {
      clientCommand:          'reqrep',
      clientBody:             'raw request',
      expectedClientCommand:  'reqrep',
      expectedClientBody:     'raw request',
      backendCommand:         'reqrep.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'reqrep.response',
      expectedBackendBody:    'raw response'        
    });

    testReqRep('modified event type', {
      clientCommand:          'reqrep-mod-event',
      clientBody:             'raw request',
      expectedClientCommand:  'reqrep-mod-event.mod',
      expectedClientBody:     'raw request',
      backendCommand:         'reqrep-mod-event.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'reqrep-mod-event.response.mod',
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

    test('multiple clients', function(done) {
      var messages = [
        '0-a',
        '1-a',
        '2-a',
        '0-b',
        '1-b',
        '2-b'
      ];
      var clientReceiver;
      utils.setupApplication()
        .next(function(result) {
          server     = result.server;
          connection = result.connection;
          backend    = result.backend;
          socketIoAdaptor.register(result.application, server, {
            tag:      'test',
            connection: connection,
            plugins: [testPlugin]
          });
        })
        .createClientSockets(3)
        .next(function(newClientSockets) {
          clientSockets = clientSockets.concat(newClientSockets);
          clientSockets[0].emit('reqrep', messages[0]);
        }).wait(0.01).next(function() {
          clientSockets[1].emit('reqrep', messages[1]);
        }).wait(0.01).next(function() {
          clientSockets[2].emit('reqrep', messages[2]);
        }).wait(0.01).next(function() {
          clientSockets[0].emit('reqrep', messages[3]);
        }).wait(0.01).next(function() {
          clientSockets[1].emit('reqrep', messages[4]);
        }).wait(0.01).next(function() {
          clientSockets[2].emit('reqrep', messages[5]);
        }).wait(0.01).next(function() {
          assert.deepEqual(backend.getBodies(), messages);

          var responses = backend.getMessages().map(function(envelope) {
            return utils.createReplyEnvelope(envelope, 'reqrep', envelope.body);
          });

          clientReceiver = nodemock
            .mock('receive').takes('0:' + messages[0])
            .mock('receive').takes('1:' + messages[1])
            .mock('receive').takes('2:' + messages[2])
            .mock('receive').takes('0:' + messages[3])
            .mock('receive').takes('1:' + messages[4])
            .mock('receive').takes('2:' + messages[5]);
          clientSockets[0].on('reqrep', function(data) {
            clientReceiver.receive('0:' + data);
          });
          clientSockets[1].on('reqrep', function(data) {
            clientReceiver.receive('1:' + data);
          });
          clientSockets[2].on('reqrep', function(data) {
            clientReceiver.receive('2:' + data);
          });

          return utils
            .sendPacketTo(utils.createPacket(responses[0]), utils.testReceivePort)
            .wait(0.01)
            .sendPacketTo(utils.createPacket(responses[1]), utils.testReceivePort)
            .wait(0.01)
            .sendPacketTo(utils.createPacket(responses[2]), utils.testReceivePort)
            .wait(0.01)
            .sendPacketTo(utils.createPacket(responses[3]), utils.testReceivePort)
            .wait(0.01)
            .sendPacketTo(utils.createPacket(responses[4]), utils.testReceivePort)
            .wait(0.01)
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
  });

  suite('publish-subscribe', function() {
    function testPubSub(description, params) {
      test(description, function(done) {
        var mockedReceiver;
        utils.setupApplication()
          .next(function(result) {
            server     = result.server;
            connection = result.connection;
            backend    = result.backend;
            socketIoAdaptor.register(result.application, server, {
              tag:      'test',
              connection: connection,
              plugins: [testPlugin]
            });
          })
          .createClientSocket()
          .next(function(newClientSocket) {
            clientSockets.push(newClientSocket);
            clientSockets[0].emit(params.clientCommand, params.clientBody);
          })
          .wait(0.01)
          .next(function() {
            backend.assertReceived([{ type: params.expectedClientCommand,
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

    testPubSub('basic', {
      clientCommand:          'pubsub.subscribe',
      clientBody:             'raw request',
      expectedClientCommand:  'pubsub.subscribe',
      expectedClientBody:     'raw request',
      backendCommand:         'pubsub',
      backendBody:            'raw response',
      expectedBackendCommand: 'pubsub',
      expectedBackendBody:    'raw response'        
    });

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

    test('multiple clients', function(done) {
      var messages = [
        'a',
        'b'
      ];
      var clientReceiver;
      utils.setupApplication()
        .next(function(result) {
          server     = result.server;
          connection = result.connection;
          backend    = result.backend;
          socketIoAdaptor.register(result.application, server, {
            tag:      'test',
            connection: connection,
            plugins: [testPlugin]
          });
        })
        .createClientSockets(3)
        .next(function(newClientSockets) {
          clientSockets = clientSockets.concat(newClientSockets);
          clientSockets[0].emit('pubsub.subscribe', 0);
        }).wait(0.01).next(function() {
          clientSockets[1].emit('pubsub.subscribe', 1);
        }).wait(0.01).next(function() {
          clientSockets[2].emit('pubsub.subscribe', 2);
        }).wait(0.01).next(function() {
          assert.deepEqual(backend.getBodies(),
                           [0, 1, 2]);

          var publisheds = messages.map(function(message) {
            return utils.createEnvelope('pubsub', message);
          });

          clientReceiver = nodemock
            .mock('receive').takes('0:' + messages[0])
            .mock('receive').takes('1:' + messages[0])
            .mock('receive').takes('2:' + messages[0])
            .mock('receive').takes('0:' + messages[1])
            .mock('receive').takes('1:' + messages[1])
            .mock('receive').takes('2:' + messages[1]);
          clientSockets[0].on('pubsub', function(data) {
            clientReceiver.receive('0:' + data);
          });
          clientSockets[1].on('pubsub', function(data) {
            clientReceiver.receive('1:' + data);
          });
          clientSockets[2].on('pubsub', function(data) {
            clientReceiver.receive('2:' + data);
          });

          return utils
            .sendPacketTo(utils.createPacket(publisheds[0]), utils.testReceivePort)
            .wait(0.01)
            .sendPacketTo(utils.createPacket(publisheds[1]), utils.testReceivePort);
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
  });
});

