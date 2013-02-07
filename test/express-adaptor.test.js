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
    function defineCommand(command, path) {
      return {
        method: 'GET',
        path: path,
        requestBuilder: function() {},
        responseBuilder: function() {}
      };
    }
    var testPlugin = {
      api: new model.REST({
        path: '/path/to/api',
        toBackend: function() { return 'api requested'; },
        toClient: function() { return 'api OK'; }
      })
    };

    var connection;
    var application;
    var server;

    setup(function(done) {
      connection = utils.createMockedBackendConnection();
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
      connection
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
      connection
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
      connection = utils.createMockedBackendConnection()
        .mock('emitMessage')
          .takes('search', { requestMessage: true });

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
      connection = utils.createMockedBackendConnection();
      connection.emitMessage = function() {}; // stubbing

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
          application.kotoumi({
            connection: connection,
            server:     server
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
  });
});

