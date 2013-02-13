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

    testPubSub('basic', {
      clientCommand:          'pubsub',
      clientBody:             'raw request',
      expectedClientCommand:  'pubsub',
      expectedClientBody:     'raw request',
      backendCommand:         'pubsub.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'pubsub.response',
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
  });
});

