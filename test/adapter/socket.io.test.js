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
      connectionPool = utils.createStubbedBackendConnectionPool();
      connection = connectionPool.get();
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
        .then(utils.createClientCb())
        .then(function(newClient) {
          clientSockets.push(newClient.socket);
          mockedReceiver = nodemock
            .mock('receive')
              .takes(params.body);
          clientSockets[0].on(params.expectedResponse, function(data) {
            mockedReceiver.receive(data);
          });
          clientSockets[0].emit(params.request, params.body);
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          assert.deepEqual(
            connection.emitMessageCalledArguments.map(function(args) {
              return { type:    args.type,
                       message: args.message };
            }),
            [
              { type:    params.expectedRequest,
                message: params.body }
            ]
          );
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
      connection = connectionPool.get();
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
          clientSockets = clientSockets.concat(newClients.map(function(client) { return client.socket; }));

          clientReceiver = nodemock
            .mock('receive').takes('0:' + messages[0])
            .mock('receive').takes('1:' + messages[1])
            .mock('receive').takes('2:' + messages[2])
            .mock('receive').takes('0:' + messages[3])
            .mock('receive').takes('1:' + messages[4])
            .mock('receive').takes('2:' + messages[5]);

          clientSockets[0].on('reqrep.result', function(data) {
            clientReceiver.receive('0:' + data);
          });
          clientSockets[1].on('reqrep.result', function(data) {
            clientReceiver.receive('1:' + data);
          });
          clientSockets[2].on('reqrep.result', function(data) {
            clientReceiver.receive('2:' + data);
          });
        }).then(utils.waitCb(0.01)).then(function() {
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
          assert.deepEqual(
            connection.emitMessageCalledArguments.map(function(args) {
              return { type:    args.type,
                       message: args.message };
            }),
            messages.map(function(message) {
              return { type:    'reqrep',
                       message: message };
            })
          );
          clientReceiver.assertThrows();
          done();
        })
        .catch(done);
    });

    test('event with custom response event', function(done) {
      var clientReceiver;
      connectionPool = utils.createStubbedBackendConnectionPool();
      connection = connectionPool.get();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server     = result.server;
          connectionPool = result.connectionPool;
          connection = connectionPool.get();
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
          clientSockets = clientSockets.concat(newClients.map(function(client) { return client.socket; }));

          clientReceiver = nodemock
            .mock('receive').takes('message1')
            .mock('receive').takes('message2');

          clientSockets[0].on('reqrep.extra.name', function(data) {
            clientReceiver.receive(data);
          });
          clientSockets[0].on('reqrep-mod-event.extra.name', function(data) {
            clientReceiver.receive(data);
          });

          clientSockets[0].emit('reqrep', 'message1',
                                { responseEvent: 'reqrep.extra.name' });
          clientSockets[0].emit('reqrep-mod-event', 'message2',
                                { responseEvent: 'reqrep-mod-event.extra.name' });
        }).then(utils.waitCb(0.01)).then(function() {
          assert.deepEqual(
            connection.emitMessageCalledArguments.map(function(args) {
              var options = {};
              if (args.options)
                options.responseEvent = args.options.responseEvent;
              return { type:    args.type,
                       message: args.message };
            }),
            [
              { type:    'reqrep',
                message: 'message1' },
              { type:    'reqrep-mod-event.mod',
                message: 'message2' }
            ]
          );
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
          clientSockets[0].on('pubsub.subscribe.result', function(data) {
            mockedReceiver.receive(data);
          });
          clientSockets[0].on('pubsub.unsubscribe.result', function(data) {
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
                                      'pubsub.subscribe.result',
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
                                      'pubsub.unsubscribe.result',
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

