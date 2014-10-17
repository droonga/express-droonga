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
  var clients;
  var backend;

  var testPlugin = {
    'reqrep': new command.SocketRequestResponse(),
    'reqrep-mod-event': new command.SocketRequestResponse({
      onRequest: function(data, connection) {
        connection.emit('reqrep-mod-event.mod', data);
      },
      onResponse: function(data, socket) {
        socket.emit('reqrep-mod-event.result.mod', data);
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
        socket.emit('pubsub-mod-event.mod.subscribe.result', data);
      },
      onUnsubscribe: function(data, connection) {
        connection.emit('pubsub-mod-event.mod.unsubscribe', data);
      },
      onUnsubscribed: function(data, socket) {
        socket.emit('pubsub-mod-event.mod.unsubscribe.result', data);
      },
      messageType: 'pubsub-mod-event.publish',
      onPublish: function(data, socket) {
        socket.emit('pubsub-mod-event.mod.publish', data);
      }
    })
  };

  function setupEnvironment() {
    clients = [];
  }
  function teardownEnvironment() {
    if (clients.length) {
      clients.forEach(function(client) {
        client.socket.disconnect();
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
          clients = [newClient];
          mockedListener.assertThrows();
          done();
        })
        .catch(done);
    });
  });

  function testReqRep(test, description, params) {
    test(description, function(done) {
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server     = result.server;
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              testPlugin
            ]
          });
        })
        .then(utils.createClientsCb(1))
        .then(function(newClients) {
          clients = newClients;
          clients[0].expectReceive(params.expectedResponse, params.body);
          clients[0].socket.emit(params.request, params.body);
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          assert.deepEqual(
            connectionPool.emittedMessages,
            [
               [
                 { type:    params.expectedRequest,
                   message: params.body }
               ]
            ]
          );
          clients[0].assertThrows();
          done();
        })
        .catch(done);
    });
  }

  suite('request-response', function() {
    setup(setupEnvironment);
    teardown(teardownEnvironment);

    testReqRep(test, 'basic', {
      request:          'reqrep',
      expectedRequest:  'reqrep',
      expectedResponse: 'reqrep.result',
      body:             'raw request'
    });

    testReqRep(test, 'modified event type', {
      request:          'reqrep-mod-event',
      expectedRequest:  'reqrep-mod-event.mod',
      expectedResponse: 'reqrep-mod-event.result.mod',
      body:             'raw request'     
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
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server     = result.server;
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              testPlugin
            ]
          });
        })
        .then(utils.createClientsCb(3))
        .then(function(newClients) {
          clients = newClients;

          clients[0]
            .expectReceive('reqrep.result', messages[0])
            .expectReceive('reqrep.result', messages[3]);
          clients[1]
            .expectReceive('reqrep.result', messages[1])
            .expectReceive('reqrep.result', messages[4]);
          clients[2]
            .expectReceive('reqrep.result', messages[2])
            .expectReceive('reqrep.result', messages[5]);

        }).then(utils.waitCb(0.01)).then(function() {
          clients[0].socket.emit('reqrep', messages[0]);
        }).then(utils.waitCb(0.01)).then(function() {
          clients[1].socket.emit('reqrep', messages[1]);
        }).then(utils.waitCb(0.01)).then(function() {
          clients[2].socket.emit('reqrep', messages[2]);
        }).then(utils.waitCb(0.01)).then(function() {
          clients[0].socket.emit('reqrep', messages[3]);
        }).then(utils.waitCb(0.01)).then(function() {
          clients[1].socket.emit('reqrep', messages[4]);
        }).then(utils.waitCb(0.01)).then(function() {
          clients[2].socket.emit('reqrep', messages[5]);
        }).then(utils.waitCb(0.01)).then(function() {
          assert.deepEqual(
            connectionPool.emittedMessages,
            [
              messages.map(function(message) {
                return { type:    'reqrep',
                         message: message };
              })
            ]
          );
          clients[0].assertThrows();
          clients[1].assertThrows();
          clients[2].assertThrows();
          done();
        })
        .catch(done);
    });

    test('event with custom response event', function(done) {
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
          backend    = result.backend;
          socketIoAdapter.register(result.application, server, {
            tag:      utils.testTag,
            connectionPool: connectionPool,
            plugins: [
              testPlugin
            ]
          });
        })
        .then(utils.createClientsCb(1))
        .then(function(newClients) {
          clients = newClients;

          clients[0]
            .expectReceive('reqrep.extra.name', 'message1')
            .expectReceive('reqrep-mod-event.extra.name', 'message2');

          clients[0].socket.emit('reqrep', 'message1',
                                  { responseEvent: 'reqrep.extra.name' });
          clients[0].socket.emit('reqrep-mod-event', 'message2',
                                  { responseEvent: 'reqrep-mod-event.extra.name' });
        }).then(utils.waitCb(0.01)).then(function() {
          assert.deepEqual(
            connectionPool.emittedMessages,
            [
              [
                { type:    'reqrep',
                  message: 'message1' },
                { type:    'reqrep-mod-event.mod',
                  message: 'message2' }
              ]
            ]
          );
          clients[0].assertThrows();
          done();
        })
        .catch(done);
    });
  });

  suite('publish-subscribe', function() {
    setup(setupEnvironment);
    teardown(teardownEnvironment);

    testReqRep(test, 'basic', {
      request:          'pubsub.subscribe',
      expectedRequest:  'pubsub.subscribe',
      expectedResponse: 'pubsub.subscribe.result',
      body:             'raw request'
    });

    testReqRep(test, 'modified event type', {
      request:          'pubsub-mod-event.subscribe',
      expectedRequest:  'pubsub-mod-event.mod.subscribe',
      expectedResponse: 'pubsub-mod-event.mod.subscribe.result',
      body:             'raw request'
    });

    test('publish', function(done) {
      var subscriberId;
      utils.setupApplication()
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
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
          clients = newClients;
          subscriberId = clients[0].subscriber;

          clients[0]
            .expectReceive('pubsub.subscribe.result', 'subscribed!')
            .expectReceive('pubsub.publish', 'published 1')
            .expectReceive('pubsub.publish', 'published 2')
            .expectReceive('pubsub.publish', 'published 3')
            .expectReceive('pubsub.unsubscribe.result', 'unsubscribed!');

          // published messages before subscribing: should be ignored
          return backend.sendMessage('pubsub.publish',
                                     'never published',
                                     { to: subscriberId });
        })
        .then(function() {
          backend.reserveResponse(function(request) {
            var requestEnvelope = request[2];
            return utils.createPacket(
              utils.createReplyEnvelope(requestEnvelope,
                                          'pubsub.subscribe.result',
                                          'subscribed!')
            );
          });
          clients[0].socket.emit('pubsub.subscribe', 'subscribe!');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
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
          backend.reserveResponse(function(request) {
            var requestEnvelope = request[2];
            return utils.createPacket(
              utils.createReplyEnvelope(requestEnvelope,
                                          'pubsub.unsubscribe.result',
                                          'unsubscribed!')
            );
          });
          clients[0].socket.emit('pubsub.unsubscribe', 'unsubscribe!');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          // published messages after unsubscribing: should be ignored
          return backend.sendMessage('pubsub.publish',
                                     'never published');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          clients[0].assertThrows();
          done();
        })
        .catch(done);
    });
  });
});

