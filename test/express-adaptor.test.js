var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var adaptor = require('../index');
var Connection = require('../lib/backend/connection').Connection;

suite('Adaption for express application', function() {
  suite('REST API', function() {
    function createHandlerFactory(type) {
      return function() {
        return function(request, response) {
          response.contentType('text/plain');
          response.send(type + ' OK', 200);
        };
      };
    }
    var handlersFactory = {
      search: createHandlerFactory('search')
    };

    var server;

    teardown(function() {
      if (server) {
        server.close();
        server = undefined;
      }
    });

    test('to the document root', function(done) {
      var application = express();
      application.kotoumi({
        prefix:     '',
        connection: 'fake connection',
        handlers:   handlersFactory
      });

      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
        })
        .get('/tables/foobar')
        .next(function(response) {
          assert.equal('search OK', response.body);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      var application = express();
      application.kotoumi({
        prefix:     '/path/to/kotoumi',
        connection: 'fake connection',
        handlers:   handlersFactory
      });
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
        })
        .get('/path/to/kotoumi/tables/foobar')
        .next(function(response) {
          assert.equal('search OK', response.body);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });

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
      var handlersFactory = utils.createMockedHandlersFactory();
      var connection = utils.createMockedBackendConnection()
            .mock('emitMessage')
              .takes('search', { requestMessage: true });

      var application = express();
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
          application.kotoumi({
            connection: connection,
            server:     server,
            handlers:   handlersFactory
          });
          handlersFactory.assertThrows();

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
      var handlersFactory = utils.createMockedHandlersFactory();
      var connection = utils.createMockedBackendConnection();

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
            server:     server,
            handlers:   handlersFactory
          });
          handlersFactory.assertThrows();

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
  });
});

