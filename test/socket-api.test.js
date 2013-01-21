var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');

var express = require('express');
var socketAdaptor = require('../lib/socket-adaptor');
var Connection = require('../lib/backend-adaptor').Connection;

var client = require('socket.io-client');

suite('Socket.IO API', function() {
  function createClientSocket() {
    var host = 'http://localhost:' + utils.testServerPort;
    var options = { 'force new connection': true };
    return client.connect(host, options);
  }

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
    var connection = nodemock
          .mock('on')
            .takes('message', function() {})
            .times(socketAdaptor.commands.length)
          .mock('emitMessage')
            .takes('search', { requestMessage: true });

    var application = express();
    server = utils.setupServer(application);
    socketAdaptor.registerHandlers(application, server, {
      connection: connection
    });

    clientSocket = createClientSocket();

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
    var connection = nodemock;
    var onMessageControllers = {};
    socketAdaptor.commands.forEach(function(command) {
      onMessageControllers[command] = {};
      connection = connection
        .mock('on')
        .takes('message', function() {})
        .ctrl(1, onMessageControllers[command]);
    });

    var application = express();
    server = utils.setupServer(application);
    socketAdaptor.registerHandlers(application, server, {
      connection: connection
    });

    clientSocket = createClientSocket();

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
        onMessageControllers.search.trigger(envelope);
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

