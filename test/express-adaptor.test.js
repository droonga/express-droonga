var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var adaptor = require('../index');
var model = require('../lib/model');
var Connection = require('../lib/backend/connection').Connection;

suite('Adaption for express application', function() {
  suite('REST API registeration', function() {
    var testPlugin = {
      api: new model.REST({
        path: '/path/to/api',
        toBackend: function(event, request) { return [event, 'api requested']; },
        toClient: function(event, data) { return [event, 'api OK']; }
      })
    };

    var connection;
    var application;
    var server;

    setup(function(done) {
      connection = utils.createMockedBackendConnection(testPlugin);
      application = express();
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
          done();
        });
    });

    teardown(function() {
      if (connection) {
        utils.readyToDestroyMockedConnection(connection);
        connection = undefined;
      }
      if (server) {
        server.close();
        server = undefined;
      }
    });

    test('to the document root', function(done) {
      var onReceive = {};
      connection = connection
        .mock('emitMessage')
          .takes('api', 'api requested', function() {}, { 'timeout': null })
          .ctrl(2, onReceive);

      application.kotoumi({
        prefix:     '',
        connection: connection,
        plugins:    [testPlugin]
      });

      var responseBody;
      Deferred
        .wait(0.01)
        .next(function() {
          utils.get('/path/to/api')
            .next(function(response) {
              responseBody = response.body;
            });
        })
        .wait(0.01)
        .next(function() {
          connection.assertThrows();
          onReceive.trigger(null, { body: 'API OK?' });
        })
        .wait(0.01)
        .next(function() {
          assert.equal(responseBody, 'api OK');
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      var onReceive = {};
      connection = connection
        .mock('emitMessage')
          .takes('api', 'api requested', function() {}, { 'timeout': null })
          .ctrl(2, onReceive);

      application.kotoumi({
        prefix:     '/path/to/kotoumi',
        connection: connection,
        plugins:    [testPlugin]
      });

      var responseBody;
      Deferred
        .wait(0.01)
        .next(function() {
          utils.get('/path/to/kotoumi/path/to/api')
            .next(function(response) {
              responseBody = response.body;
            });
        })
        .wait(0.01)
        .next(function() {
          connection.assertThrows();
          onReceive.trigger(null, { body: 'API OK?' });
        })
        .wait(0.01)
        .next(function() {
          assert.equal(responseBody, 'api OK');
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });

  suite('Socket.IO API registeration', function() {
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

    test('front to back', function(done) {
      connection = utils.createMockedBackendConnection(utils.socketIoDefaultCommandsModule)
        .mock('emitMessage')
          .takes('search',
                 { requestMessage: true },
                 function() {},
                 { timeout: 10 * 1000 });

      var application = express();
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
          application.kotoumi({
            connection: connection,
            server:     server
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
      var onResponse = {};
      connection = utils.createMockedBackendConnection(utils.socketIoDefaultCommandsModule)
        .mock('emitMessage')
          .takes('search',
                 { requestMessage: true },
                 function() {},
                 { timeout: 10 * 1000 })
          .ctrl(2, onResponse);

      var clientReceiver = nodemock
            .mock('receive')
            .takes({ searchResult: true });

      var application = express();
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
          application.kotoumi({
            connection: connection,
            server:     server
          });

          return utils.createClientSocket();
        })
        .next(function(newClientSocket) {
          clientSocket = newClientSocket;

          clientSocket.on('search.result', function(data) {
            clientReceiver.receive(data);
          });
          clientSocket.emit('search', { requestMessage: true });
        })
        .wait(0.1)
        .next(function() {
          connection.assertThrows();
          var envelope = {
            statusCode: 200,
            type:       'search.result',
            body:       { searchResult: true}
          };
          onResponse.trigger(null, envelope);
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
});

