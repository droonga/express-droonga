var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var socketAdaptor = require('../lib/socket-adaptor');
var Connection = require('../lib/backend-adaptor').Connection;

suite('Socket.IO API', function() {
  var server;
  var clientSocket;

  teardown(function() {
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket = undefined;
    }
    if (server) {
      server.close();
      server = undefined;
    }
  });

  test('front to back', function(done) {
    var connection = utils.createMockedBackendConnection()
          .mock('emitMessage')
            .takes('search', { requestMessage: true });

    var application = express();
    server = utils.setupServer(application);
    socketAdaptor.registerHandlers(application, server, {
      connection: connection
    });

    clientSocket = utils.createClientSocket();

    Deferred
      .wait(0.01)
      .next(function() {
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
    var connection = utils.createMockedBackendConnection();

    var application = express();
    server = utils.setupServer(application);
    socketAdaptor.registerHandlers(application, server, {
      connection: connection
    });

    clientSocket = utils.createClientSocket();

    var clientReceiver = nodemock
          .mock('receive')
          .takes({
            statusCode: 200,
            body:       { searchResult: true }
          });
    clientSocket.on('search.result', function(data) {
      clientReceiver.receive(data);
    });

    Deferred
      .wait(0.01)
      .next(function() {
        connection.assertThrows();

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
    var connection = utils.createMockedBackendConnection()
          .mock('on')
            .takes('message', function() {})
            .ctrl(1, extraController)
          .mock('emitMessage')
            .takes('foobar', { requestMessage: true });

    var application = express();
    server = utils.setupServer(application);
    socketAdaptor.registerHandlers(application, server, {
      connection: connection,
      extraCommands: [
        'foobar'
      ]
    });

    clientSocket = utils.createClientSocket();

    Deferred
      .wait(0.01)
      .next(function() {
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

