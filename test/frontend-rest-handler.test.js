var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var restHandler = require('../lib/frontend/rest-handler');
var Connection = require('../lib/backend/connection').Connection;

suite('REST API', function() {
  function createFakeConnection() {
    return {
      emitMessage: function() {},
      emit: function() {},
      on: function() {}
    };
  }

  test('registeration for given handlers', function() {
    var fakeConnection = createFakeConnection();
    var mockedHandlers = nodemock.mock('search')
          .takes(fakeConnection)
          .returns(function() {});
    var application = express();
    restHandler.register(application, {
      prefix:     '',
      connection: fakeConnection,
      handlers:   mockedHandlers
    });
    mockedHandlers.assertThrows();
  });

  suite('registeration', function() {
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
      }
      server = undefined;
    });

    test('to the document root', function(done) {
      var fakeConnection = createFakeConnection();
      var application = express();
      restHandler.register(application, {
        prefix:     '',
        connection: fakeConnection,
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
      var fakeConnection = createFakeConnection();
      var application = express();
      restHandler.register(application, {
        prefix:     '/path/to/kotoumi',
        connection: fakeConnection,
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

  test('creation of REST handler', function() {
    var requestBuilders = nodemock
          .mock('search')
            .takes({ request: true })
            .returns({ requestMessage: true });

    var onReceive = {};
    var connection = nodemock
          .mock('emitMessage')
            .takes('search', { requestMessage: true }, function() {}, {})
            .ctrl(2, onReceive);
    var handler = restHandler
          .createHandler('search',
                         requestBuilders.search,
                         connection);

    var fakeRequest = { request: true };
    var fakeResponse = nodemock
          .mock('contentType')
            .takes('application/json')
          .mock('send')
            .takes({ response: true }, 200);

    handler(fakeRequest, fakeResponse);
    requestBuilders.assertThrows();
    connection.assertThrows();

    onReceive.trigger(null, { body: { response: true } });
    fakeResponse.assertThrows();
  });

  suite('default handlers', function() {
    var server;

    teardown(function() {
      if (server) {
        server.close();
      }
      server = undefined;
    });

    test('search', function(done) {
      var receiverCallback = {};
      var connection = {
            emitMessage: function(type, message, callback, options) {
              this.emitMessageCalledArguments.push({
                type:     type,
                message:  message,
                callback: callback,
                options:  options
              });
            },
            emitMessageCalledArguments: []
          };
      var application = express();
      restHandler.register(application, {
        prefix:     '',
        connection: connection
      });
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
          utils.get('/tables/foo?query=bar');
        })
        .wait(0.1)
        .next(function() {
          assert.equal(1, connection.emitMessageCalledArguments.length);
          var args = connection.emitMessageCalledArguments[0];
          assert.equal(args.type, 'search');

          var expected = {
            queries: {
              result: {
                source: 'foo',
                query:  'bar',
                output: utils.outputAll
              }
            }
          };
          assert.equalJSON(args.message, expected);

          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });
});

