var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var socketIoHandler = require('../lib/frontend/socket.io-handler');
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
        socketIoHandler.register(application, server, {
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
        socketIoHandler.register(application, server, {
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
        socketIoHandler.register(application, server, {
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

  test('front to back, extra command', function(done) {
    var extraController = {};
    connection = utils.createMockedBackendConnection()
      .mock('on')
        .takes('message', function() {})
        .ctrl(1, extraController)
      .mock('emitMessage')
        .takes('foobar', { requestMessage: true });

    var application = express();
    utils.setupServer(application)
      .next(function(newServer) {
        server = newServer;
        socketIoHandler.register(application, server, {
          connection: connection,
          extraCommands: [
            'foobar'
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
        connection
          .mock('removeListener')
          .takes('message', function() {});
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

