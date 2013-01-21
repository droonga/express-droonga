var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var restAdaptor = require('../lib/rest-adaptor');
var Connection = require('../lib/backend-adaptor').Connection;

suite('REST API', function() {
  test('registeration for given handlers', function() {
    var mockedHandlers = nodemock.mock('search')
          .takes('fake connection')
          .returns(function() {});
    var application = express();
    restAdaptor.registerHandlers(application, {
      prefix:     '',
      connection: 'fake connection',
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
      var application = express();
      restAdaptor.registerHandlers(application, {
        prefix:     '',
        connection: 'fake connection',
        handlers:   handlersFactory
      });
      server = utils.setupServer(application);

      utils
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
      restAdaptor.registerHandlers(application, {
        prefix:     '/path/to/kotoumi',
        connection: 'fake connection',
        handlers:   handlersFactory
      });
      server = utils.setupServer(application);

      utils
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
    var responseBuilders = nodemock
          .mock('search')
            .takes({ responseMessage: true })
            .returns({ response: true });

    var onReceive = {};
    var connection = nodemock
          .mock('emitMessage')
            .takes('search', { requestMessage: true }, function() {})
            .ctrl(2, onReceive);
    var handler = restAdaptor
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
    connection.assertThrows();

    onReceive.trigger({ responseMessage: true });
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
            emitMessage: function(type, message, callback) {
              this.emitMessageCalledArguments.push({
                type:     type,
                message:  message,
                callback: callback
              });
            },
            emitMessageCalledArguments: []
          };
      var application = express();
      restAdaptor.registerHandlers(application, {
        prefix:     '',
        connection: connection
      });
      server = utils.setupServer(application);

      utils.get('/tables/foo?query=bar');

      setTimeout(function() {
        try {
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
        } catch(error) {
          done(error);
        }
      }, 100);
    });
  });
});

