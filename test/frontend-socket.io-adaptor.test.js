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
            command: command.command,
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
    connection = utils.createMockedBackendConnection();

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

        connection = connection
          .mock('emitMessage')
            .takes('search', { requestMessage: true });
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
        connection.controllers.search.trigger(envelope);
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

  var testPlugin = {
    'foobar': new model.SocketCommand(),
    'builder': new model.SocketRequestResponse({
      toBackend: function() { return 'builder request'; },
      toClient: function() { return 'builder response' }
    }),
    'customevent': new model.SocketRequestResponse({
      toBackend: 'custom',
      toClient: function() { return 'custom response' }
    })
  };

  test('front to back, extra command (without builder)', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection();

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
        clientSocket = newClientSocket;

        connection = connection
          .mock('emitMessage')
            .takes('foobar', { requestMessage: true });
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

  test('front to back, extra command (with builder)', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection();

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
        clientSocket = newClientSocket;

        connection = connection
          .mock('emitMessage')
            .takes('builder', 'builder request');
        clientSocket.on('builder.result', function(data) {
          mockedReceiver.receive(data);
        });
        clientSocket.emit('builder', { requestMessage: true });
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
    connection = utils.createMockedBackendConnection();

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
        clientSocket = newClientSocket;

        connection = connection
          .mock('emitMessage')
            .takes('customevent', { requestMessage: true });
        clientSocket.on('custom', function(data) {
          mockedReceiver.receive(data);
        });
        clientSocket.emit('customevent', { requestMessage: true });
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

