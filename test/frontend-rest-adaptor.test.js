var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var restAdaptor = require('../lib/frontend/rest-adaptor');
var restCommands = require('../lib/frontend/default-commands/rest');
var Connection = require('../lib/backend/connection').Connection;

suite('REST API', function() {
  test('registeration of plugin commands', function() {
    var basePlugin = {
      getCommand: {
        method: 'GET',
        path: '/get',
        requestBuilder: function() {}
      },
      putCommand: {
        method: 'PUT',
        path: '/put',
        requestBuilder: function() {}
      },
      postCommand: {
        method: 'POST',
        path: '/post',
        requestBuilder: function() {}
      },
      deleteCommand: {
        method: 'DELETE',
        path: '/delete',
        requestBuilder: function() {}
      }
    };
    var overridingPlugin = {
      postCommand: {
        method: 'POST',
        path: '/post/overridden',
        requestBuilder: function() {}
      },
      deleteCommand: {
        method: 'DELETE',
        path: '/delete/overridden',
        requestBuilder: function() {}
      }
    };

    var application = express();
    var registeredCommands = restAdaptor.register(application, {
      prefix:     '',
      connection: utils.createStubbedBackendConnection(),
      plugins: [
        basePlugin,
        overridingPlugin
      ]
    });

    assert.deepEqual(registeredCommands,
                     [{ command: 'search',
                        definition: restCommands.search },
                      { command: 'getCommand',
                        definition: basePlugin.getCommand },
                      { command: 'putCommand',
                        definition: basePlugin.putCommand },
                      { command: 'postCommand',
                        definition: overridingPlugin.postCommand },
                      { command: 'deleteCommand',
                        definition: overridingPlugin.deleteCommand }]);
  });

  suite('registeration', function() {
    function defineCommand(command, path) {
      return {
        method: 'GET',
        path: path,
        requestBuilder: function() { return command + ' requested'; },
        responseBuilder: function() { return command + ' OK'; }
      };
    }
    var testPlugin = {
      api: defineCommand('api', '/path/to/api')
    };

    var server;
    teardown(function() {
      if (server) {
        server.close();
      }
      server = undefined;
    });

    test('to the document root', function(done) {
      var fakeConnection = utils.createStubbedBackendConnection();
      var application = express();
      restAdaptor.register(application, {
        prefix:     '',
        connection: fakeConnection,
        plugins:    [testPlugin]
      });
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
        })
        .get('/path/to/api')
        .next(function(response) {
          assert.equal(response.body, 'api OK');
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      var fakeConnection = utils.createStubbedBackendConnection();
      var application = express();
      restAdaptor.register(application, {
        prefix:     '/path/to/kotoumi',
        connection: fakeConnection,
        plugins:    [testPlugin]
      });
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
        })
        .get('/path/to/kotoumi/path/to/api')
        .next(function(response) {
          assert.equal(response.body, 'api OK');
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
    var handler = restAdaptor
          .createHandler({
            command:        'search',
            requestBuilder: requestBuilders.search,
            connection:     connection
          });

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
      restAdaptor.register(application, {
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

