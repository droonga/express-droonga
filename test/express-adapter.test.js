var assert = require('chai').assert;
var nodemock = require('nodemock');
var express = require('express');

var utils = require('./test-utils');

var adapter = require('../index');
var command = require('../lib/adapter/command');

suite('Adaption for express application', function() {
  var testRestPlugin = {
    api: new command.HTTPRequestResponse({
      path: '/path/to/api',
      onRequest: function(request, connection) {
        connection.emit('api', 'api requested');
      },
      onResponse: function(data, response) {
        response.status(200).jsonp('api OK');
      }
    })
  };
  var testSocketPlugin = {
    api: new command.SocketRequestResponse({
      onRequest: function(data, connection) {
        connection.emit('api', 'api requested');
      },
      onResponse: function(data, socket) {
        socket.emit('api.response', 'api OK');
      }
    })
  };

  suite('REST API registeration', function() {
    var connectionPool;
    var application;
    var server;

    setup(function(done) {
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server = result.server;
          application = result.application;
          done();
        })
        .catch(done);
    });

    teardown(function() {
      utils.teardownApplication({ server:     server,
                                  connectionPool: connectionPool });
    });

    test('to the document root', function(done) {
      application.droonga({
        prefix:     '',
        connectionPool: connectionPool,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      utils.get('/path/to/api')
        .then(function(response) {
          assert.deepEqual(response,
                           { statusCode: 200,
                             body:       JSON.stringify('api OK') });
          done();
        })
        .catch(done);
    });

    test('under specified path', function(done) {
      application.droonga({
        prefix:     '/path/to/droonga',
        connectionPool: connectionPool,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var responses = [];
      utils.get('/path/to/droonga/path/to/api')
        .then(function(response) { responses.push(response); })
        .then(function() {
          assert.deepEqual(
            connectionPool.emittedMessages,
            [
              [{ type: 'api', message: 'api requested' }]
            ]
          );
          assert.deepEqual(
            responses,
            [
              { statusCode: 200, body: JSON.stringify('api OK') }
            ]
          );
          done();
        })
        .catch(done);
    });
  });

  suite('Socket.IO API registeration', function() {
    var application;
    var connectionPool;
    var server;
    var clientSocket;

    setup(function(done) {
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server = result.server;
          application = result.application;
          done();
        })
        .catch(done);
    });

    teardown(function() {
      if (clientSocket) {
        clientSocket.disconnect();
        clientSocket = undefined;
      }
      utils.teardownApplication({ server:     server,
                                  connectionPool: connectionPool });
    });

    test('request-response', function(done) {
      application.droonga({
        connectionPool: connectionPool,
        server:     server,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var mockedReceiver;
      utils.createClient()
        .then(function(newClient) {
          clientSocket = newClient.socket;

          mockedReceiver = nodemock
            .mock('receive')
              .takes('api OK');

          clientSocket.on('api.response', function(data) {
            mockedReceiver.receive(data);
          });

          clientSocket.emit('api', 'request');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.assertThrows();
          done();
        })
        .catch(done);
    });
  });
});

