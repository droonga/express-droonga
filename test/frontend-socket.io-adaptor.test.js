var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var socketIoAdaptor = require('../lib/frontend/socket.io-adaptor');
var scoketIoCommands = require('../lib/frontend/default-commands/socket.io');
var Connection = require('../lib/backend/connection').Connection;

suite('Socket.IO API', function() {
  var connection;
  var server;
  var clientSocket;

  teardown(function() {
    if (connection) {
      utils.readyToDestroyMockedConnection(connection);
      connection = undefined;
    }
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket = undefined;
    }
    if (server) {
      server.close();
      server = undefined;
    }
  });

  test('registeration of plugin commands', function(done) {
    var basePlugin = {
      getCommand: {
        requestBuilder: function() {}
      },
      putCommand: {
        requestBuilder: function() {}
      },
      postCommand: {
        requestBuilder: function() {}
      },
      deleteCommand: {
        requestBuilder: function() {}
      }
    };
    var overridingPlugin = {
      postCommand: {
        requestBuilder: function() {}
      },
      deleteCommand: {
        requestBuilder: function() {}
      }
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
            command: command.command,
            definition: command.definition
          };
        });
        assert.deepEqual(registeredCommands,
                         [{ command: 'search',
                            definition: scoketIoCommands.search },
                          { command: 'getCommand',
                            definition: basePlugin.getCommand },
                          { command: 'putCommand',
                            definition: basePlugin.putCommand },
                          { command: 'postCommand',
                            definition: overridingPlugin.postCommand },
                          { command: 'deleteCommand',
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
          connection: utils.createStubbedBackendConnection()
        });

        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSocket = newClientSocket;
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

  test('front to back', function(done) {
    connection = utils.createMockedBackendConnection()
      .mock('emitMessage')
        .takes('search', { requestMessage: true });

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection
        });

        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSocket = newClientSocket;
        clientSocket.emit('search', { requestMessage: true });
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

  test('back to front', function(done) {
    connection = utils.createMockedBackendConnection();

    var clientReceiver = nodemock
          .mock('receive')
          .takes({
            statusCode: 200,
            body:       { searchResult: true }
          });

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection
        });

        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSocket = newClientSocket;

        connection.assertThrows();

        clientSocket.on('search.result', function(data) {
          clientReceiver.receive(data);
        });

        var envelope = {
          type:       'search.result',
          statusCode: 200,
          body:       { searchResult: true}
        };
        connection.controllers.message.trigger(envelope);
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

  test('front to back, extra command', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection()
      .mock('emitMessage')
        .takes('foobar', { requestMessage: true });

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoAdaptor.register(application, server, {
          connection: connection,
          plugins: [
            { 'foobar': {} }
          ]
        });

        return utils.createClientSocket();
      })
      .next(function(newClientSocket) {
        clientSocket = newClientSocket;
        clientSocket.emit('foobar', { requestMessage: true });
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
});

