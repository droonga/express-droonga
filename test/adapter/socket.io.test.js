var assert = require('chai').assert;
var nodemock = require('nodemock');
var express = require('express');

var utils = require('../test-utils');

var socketIoAdapter = require('../../lib/adapter/socket.io');
var command = require('../../lib/adapter/command');
var api = require('../../lib/adapter/api');
var scoketIoAPI = require('../../lib/adapter/api/socket.io');

suite('Socket.IO Adapter', function() {
  var connectionPool;
  var connection;
  var server;
  var clientSockets;
  var backend;

  var testPlugin = {
    'reqrep': new command.SocketRequestResponse(),
    'reqrep-mod-event': new command.SocketRequestResponse({
      onRequest: function(data, connection) {
        connection.emit('reqrep-mod-event.mod', data);
      },
      onResponse: function(data, socket) {
        socket.emit('reqrep-mod-event.response.mod', data);
      }
    }),
    'reqrep-mod-body': new command.SocketRequestResponse({
      onRequest: function(data, connection) {
        connection.emit('reqrep-mod-body', 'modified request');
      },
      onResponse: function(data, socket) {
        socket.emit('reqrep-mod-body.response', 'modified response');
      }
    }),
    'pubsub': new command.SocketPublishSubscribe({
      messageType: 'pubsub.publish'
    }),
    'pubsub-mod-event': new command.SocketPublishSubscribe({
      onSubscribe: function(data, connection) {
        connection.emit('pubsub-mod-event.mod.subscribe', data);
      },
      onSubscribed: function(data, socket) {
        socket.emit('pubsub-mod-event.mod.subscribe.response', data);
      },
      onUnsubscribe: function(data, connection) {
        connection.emit('pubsub-mod-event.mod.unsubscribe', data);
      },
      onUnsubscribed: function(data, socket) {
        socket.emit('pubsub-mod-event.mod.unsubscribe.response', data);
      },
      messageType: 'pubsub-mod-event.publish',
      onPublish: function(data, socket) {
        socket.emit('pubsub-mod-event.mod.publish', data);
      }
    }),
    'pubsub-mod-body': new command.SocketPublishSubscribe({
      onSubscribe: function(data, connection) {
        connection.emit('pubsub-mod-body.subscribe', 'modified request');
      },
      onSubscribed: function(data, socket) {
        socket.emit('pubsub-mod-body.subscribe.response', 'modified response');
      },
      onUnsubscribe: function(data, connection) {
        connection.emit('pubsub-mod-body.unsubscribe', 'modified request');
      },
      onUnsubscribed: function(data, socket) {
        socket.emit('pubsub-mod-body.unsubscribe.response', 'modified response');
      },
      messageType: 'pubsub-mod-body.publish',
      onPublish: function(data, socket) {
        socket.emit('pubsub-mod-body.publish', 'modified response');
      }
    })
  };

  function setupEnvironment() {
    clientSockets = [];
  }
  function teardownEnvironment() {
    if (clientSockets.length) {
      clientSockets.forEach(function(clientSocket) {
        clientSocket.disconnect();
      });
    }
    utils.teardownApplication({ backend:    backend,
                                server:     server,
                                connectionPool: connectionPool });
  }

  suite('registration', function() {
    setup(setupEnvironment);
    teardown(teardownEnvironment);

    test('registration of plugin commands', function(done) {
      var basePlugin = {
        getCommand: new command.SocketRequestResponse(),
        putCommand: new command.SocketRequestResponse(),
        postCommand: new command.SocketRequestResponse(),
        deleteCommand: new command.SocketRequestResponse(),
        ignored: new command.HTTPRequestResponse()
      };
      var overridingPlugin = {
        postCommand: new command.SocketRequestResponse(),
        deleteCommand: new command.SocketRequestResponse()
      };

      var application = express();
      utils.setupServer(application)
        .then(function(newServer) {
          server = newServer;
          connectionPool = utils.createStubbedBackendConnectionPool();
          connection = connectionPool.get();
          var registeredCommands = socketIoAdapter.register(application, server, {
            connectionPool: connectionPool,
            plugins: [
              api.API_REST,
              api.API_SOCKET_IO,
              api.API_GROONGA,
              api.API_DROONGA,
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
                              definition: scoketIoAPI.search },
                            { name:       'watch',
                              definition: scoketIoAPI.watch },
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
        .catch(done);
    });

    test('initialization', function(done) {
      var mockedListener = nodemock
        .mock('connected');

      var application = express();
      application.on('connection', function(socket) {
        mockedListener.connected();
      });

      utils.setupServer(application)
        .then(function(newServer) {
          server = newServer;
          connectionPool = utils.createStubbedBackendConnectionPool();
          connection = connectionPool.get();
          socketIoAdapter.register(application, server, {
            connectionPool: connectionPool,
            plugins: [
              api.API_REST,
              api.API_SOCKET_IO,
              api.API_GROONGA,
              api.API_DROONGA,
              testPlugin
            ]
          });

          return utils.createClient();
        })
        .then(function(newClient) {
          clientSockets.push(newClient.socket);
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedListener.assertThrows();
          done();
        })
        .catch(done);
    });
  });

  function testReqRep(test, description, params) {
    test(description, function(done) {
      var mockedReceiver;
      utils.setupApplication()
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
          connection = connectionPool.get();
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              api.API_REST,
              api.API_SOCKET_IO,
              api.API_GROONGA,
              api.API_DROONGA,
              testPlugin
            ]
          });
        })
        .then(utils.createClientCb())
        .then(function(newClient) {
          clientSockets.push(newClient.socket);
          clientSockets[0].emit(params.clientCommand, params.clientBody);
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          backend.assertReceived([{ type: params.expectedClientCommand,
                                    body: params.expectedClientBody }]);

          mockedReceiver = nodemock
            .mock('receive')
              .takes(params.expectedBackendBody);
          clientSockets[0].on(params.expectedBackendCommand, function(data) {
            mockedReceiver.receive(data);
          });

          return backend.sendResponse(backend.getMessages()[0],
                                      params.backendCommand,
                                      params.backendBody);
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.assertThrows();
          done();
        })
        .catch(done);
    });
  }

  suite('request-response', function() {
    setup(setupEnvironment);
    teardown(teardownEnvironment);

    testReqRep(test, 'basic', {
      clientCommand:          'reqrep',
      clientBody:             'raw request',
      expectedClientCommand:  'reqrep',
      expectedClientBody:     'raw request',
      backendCommand:         'reqrep.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'reqrep.response',
      expectedBackendBody:    'raw response'        
    });

    testReqRep(test, 'modified event type', {
      clientCommand:          'reqrep-mod-event',
      clientBody:             'raw request',
      expectedClientCommand:  'reqrep-mod-event.mod',
      expectedClientBody:     'raw request',
      backendCommand:         'reqrep-mod-event.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'reqrep-mod-event.response.mod',
      expectedBackendBody:    'raw response'        
    });

    testReqRep(test, 'modified body', {
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
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
          connection = connectionPool.get();
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              api.API_REST,
              api.API_SOCKET_IO,
              api.API_GROONGA,
              api.API_DROONGA,
              testPlugin
            ]
          });
        })
        .then(utils.createClientsCb(3))
        .then(function(newClients) {
          clientSockets = clientSockets.concat(newClients.map(function(client) { return client.socket; }));
          clientSockets[0].emit('reqrep', messages[0]);
        }).then(utils.waitCb(0.01)).then(function() {
          clientSockets[1].emit('reqrep', messages[1]);
        }).then(utils.waitCb(0.01)).then(function() {
          clientSockets[2].emit('reqrep', messages[2]);
        }).then(utils.waitCb(0.01)).then(function() {
          clientSockets[0].emit('reqrep', messages[3]);
        }).then(utils.waitCb(0.01)).then(function() {
          clientSockets[1].emit('reqrep', messages[4]);
        }).then(utils.waitCb(0.01)).then(function() {
          clientSockets[2].emit('reqrep', messages[5]);
        }).then(utils.waitCb(0.01)).then(function() {
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

          return utils.wait(0)
            .then(utils.sendPacketToCb(utils.createPacket(responses[0]), utils.testReceivePort))
            .then(utils.waitCb(0.01))
            .then(utils.sendPacketToCb(utils.createPacket(responses[1]), utils.testReceivePort))
            .then(utils.waitCb(0.01))
            .then(utils.sendPacketToCb(utils.createPacket(responses[2]), utils.testReceivePort))
            .then(utils.waitCb(0.01))
            .then(utils.sendPacketToCb(utils.createPacket(responses[3]), utils.testReceivePort))
            .then(utils.waitCb(0.01))
            .then(utils.sendPacketToCb(utils.createPacket(responses[4]), utils.testReceivePort))
            .then(utils.waitCb(0.01))
            .then(utils.sendPacketToCb(utils.createPacket(responses[5]), utils.testReceivePort));
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          clientReceiver.assertThrows();
          done();
        })
        .catch(done);
    });

    test('event with options', function(done) {
      var clientReceiver;
      utils.setupApplication()
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
          connection = connectionPool.get();
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              api.API_REST,
              api.API_SOCKET_IO,
              api.API_GROONGA,
              api.API_DROONGA,
              testPlugin
            ]
          });
        })
        .then(utils.createClientsCb(1))
        .then(function(newClients) {
          clientSockets = clientSockets.concat(newClients.map(function(client) { return client.socket; }));
          clientSockets[0].emit('reqrep', 'message1',
                                { responseEvent: 'reqrep.extra.name' });
          clientSockets[0].emit('reqrep-mod-event', 'message2',
                                { responseEvent: 'reqrep-mod-event.extra.name' });
        }).then(utils.waitCb(0.01)).then(function() {
          assert.deepEqual(backend.getBodies(), ['message1', 'message2']);

          var responses = backend.getMessages().map(function(envelope) {
            return utils.createReplyEnvelope(envelope, envelope.type, envelope.body);
          });

          clientReceiver = nodemock
            .mock('receive').takes('message1')
            .mock('receive').takes('message2');
          clientSockets[0].on('reqrep.extra.name', function(data) {
            clientReceiver.receive(data);
          });
          clientSockets[0].on('reqrep-mod-event.extra.name', function(data) {
            clientReceiver.receive(data);
          });

          return utils.wait(0)
            .then(utils.sendPacketToCb(utils.createPacket(responses[0]), utils.testReceivePort))
            .then(function() {
              return utils
                .sendPacketTo(utils.createPacket(responses[1]), utils.testReceivePort)
            });
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          clientReceiver.assertThrows();
          done();
        })
        .catch(done);
    });
  });

  suite('publish-subscribe', function() {
    setup(setupEnvironment);
    teardown(teardownEnvironment);

    testReqRep(test, 'basic', {
      clientCommand:          'pubsub.subscribe',
      clientBody:             'raw request',
      expectedClientCommand:  'pubsub.subscribe',
      expectedClientBody:     'raw request',
      backendCommand:         'pubsub.subscribe.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'pubsub.subscribe.response',
      expectedBackendBody:    'raw response'        
    });

    testReqRep(test, 'modified event type', {
      clientCommand:          'pubsub-mod-event.subscribe',
      clientBody:             'raw request',
      expectedClientCommand:  'pubsub-mod-event.mod.subscribe',
      expectedClientBody:     'raw request',
      backendCommand:         'pubsub-mod-event.subscribe.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'pubsub-mod-event.mod.subscribe.response',
      expectedBackendBody:    'raw response'        
    });

    testReqRep(test, 'modified body', {
      clientCommand:          'pubsub-mod-body.subscribe',
      clientBody:             'raw request',
      expectedClientCommand:  'pubsub-mod-body.subscribe',
      expectedClientBody:     'modified request',
      backendCommand:         'pubsub-mod-body.subscribe.response',
      backendBody:            'raw response',
      expectedBackendCommand: 'pubsub-mod-body.subscribe.response',
      expectedBackendBody:    'modified response'        
    });

    test('publish', function(done) {
      var mockedReceiver;
      var subscriberId;
      // step 0: setup
      utils.setupApplication()
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
          connection = connectionPool.get();
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              api.API_REST,
              api.API_SOCKET_IO,
              api.API_GROONGA,
              api.API_DROONGA,
              testPlugin
            ]
          });
        })
        .then(utils.createClientCb())
        .then(function(newClient) {
          clientSockets.push(newClient.socket);
          subscriberId = newClient.subscriber;
          clientSockets[0].on('pubsub.subscribe.response', function(data) {
            mockedReceiver.receive(data);
          });
          clientSockets[0].on('pubsub.unsubscribe.response', function(data) {
            mockedReceiver.receive(data);
          });
          clientSockets[0].on('pubsub.publish', function(data) {
            mockedReceiver.receive(data);
          });

      // step 1: published messages before subscribing
          mockedReceiver = nodemock
            .mock('receive').takes('nothing');
          return backend.sendMessage('pubsub.publish',
                                     'never published',
                                     { to: subscriberId });
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.receive('nothing');
          mockedReceiver.assertThrows();

      // step 2: subscribe
          clientSockets[0].emit('pubsub.subscribe', 'subscribe!');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          backend.assertReceived([{ type: 'pubsub.subscribe',
                                    body: 'subscribe!' }]);

          mockedReceiver = nodemock
            .mock('receive')
              .takes('subscribed!');
          return backend.sendResponse(backend.getMessages()[0],
                                      'pubsub.subscribe.response',
                                      'subscribed!');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.assertThrows();

      // step 3: published messages while subscribing
          mockedReceiver = nodemock
            .mock('receive').takes('published 1')
            .mock('receive').takes('published 2')
            .mock('receive').takes('published 3');
          return backend.sendMessage('pubsub.publish',
                                     'published 1',
                                     { to: subscriberId });
        })
        .then(function() {
          return backend.sendMessage('pubsub.publish',
                                     'published 2',
                                     { to: subscriberId });
        })
        .then(function() {
          return backend.sendMessage('pubsub.publish',
                                     'published 3',
                                     { to: subscriberId });
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.assertThrows();

      // step 4: unsubscribe
          backend.clearMessages();
          clientSockets[0].emit('pubsub.unsubscribe', 'unsubscribe!');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          backend.assertReceived([{ type: 'pubsub.unsubscribe',
                                    body: 'unsubscribe!' }]);

          mockedReceiver = nodemock
            .mock('receive')
              .takes('unsubscribed!');
          return backend.sendResponse(backend.getMessages()[0],
                                      'pubsub.unsubscribe.response',
                                      'unsubscribed!');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.assertThrows();

      // step 5: published message after unsubscribing
          mockedReceiver = nodemock
            .mock('receive').takes('nothing');
          return backend.sendMessage('pubsub.publish',
                                     'never published');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.receive('nothing');
          mockedReceiver.assertThrows();

          done();
        })
        .catch(done);
    });
  });
});

