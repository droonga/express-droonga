var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var socketAdaptor = require('../lib/socket-adaptor');
var Connection = require('../lib/backend-adaptor').Connection;

var client = require('socket.io-client');

suite('Socket.IO API', function() {
  var server;

  teardown(function() {
    if (server) {
      server.close();
    }
    server = undefined;
  });

  test('front to back', function() {
    var connection = nodemock
          .mock('emitMessage')
            .takes('search', { requestMessage: true }, function() {});

    var application = express();
    server = utils.setupServer(application);
    socketAdaptor.registerHandlers(application, server, {
      connection: connection
    });

    var clientSocket = client.connect('http://localhost:' + utils.testServerPort);
    clientSocket.emit('search', { requestMessage: true });

    connection.assertThrows();
  });
});

