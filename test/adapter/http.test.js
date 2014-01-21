var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../test-utils');

var express = require('express');
var httpAdapter = require('../../lib/adapter/http');
var command = require('../../lib/adapter/command');
var api = require('../../lib/adapter/api');
var restAPI = require('../../lib/adapter/api/rest');
var droongaAPI = require('../../lib/adapter/api/droonga');
var groongaAPI = require('../../lib/adapter/api/groonga');

suite('HTTP Adapter', function() {
  test('registeration of plugin commands', function() {
    var basePlugin = {
      getCommand: new command.HTTPRequestResponse({
        path: '/get'
      }),
      putCommand: new command.HTTPRequestResponse({
        method: 'PUT',
        path: '/put'
      }),
      postCommand: new command.HTTPRequestResponse({
        method: 'POST',
        path: '/post'
      }),
      deleteCommand: new command.HTTPRequestResponse({
        method: 'DELETE',
        path: '/delete'
      }),
      ignored: new command.SocketCommand()
    };
    var overridingPlugin = {
      postCommand: new command.HTTPRequestResponse({
        method: 'POST',
        path: '/post/overridden'
      }),
      deleteCommand: new command.HTTPRequestResponse({
        method: 'DELETE',
        path: '/delete/overridden'
      })
    };

    var application = express();
    var registeredCommands = httpAdapter.register(application, {
      prefix:     '',
      connection: utils.createStubbedBackendConnection(),
      plugins: [
        api.API_REST,
        api.API_SOCKET_IO,
        api.API_GROONGA,
        api.API_DROONGA,
        basePlugin,
        overridingPlugin
      ]
    });

    registeredCommands = registeredCommands.map(function(command) {
      return {
        name:       command.name,
        definition: command.definition
      };
    });
    assert.deepEqual(registeredCommands,
                     [{ name:       'search',
                        definition: restAPI.search },
                      { name:       'groonga',
                        definition: groongaAPI.groonga },
                      { name:       'droonga',
                        definition: droongaAPI.droonga },
                      { name:       'droonga-streaming:watch',
                        definition: droongaAPI["droonga-streaming:watch"] },
                      { name:       'getCommand',
                        definition: basePlugin.getCommand },
                      { name:       'putCommand',
                        definition: basePlugin.putCommand },
                      { name:       'postCommand',
                        definition: overridingPlugin.postCommand },
                      { name:       'deleteCommand',
                        definition: overridingPlugin.deleteCommand }]);
  });

  suite('registeration', function() {
    var testPlugin = {
      adapter: new command.HTTPRequestResponse({
        path: '/path/to/adapter',
        onRequest: function(request, connection) {
          connection.emit('adapter', 'adapter requested');
        },
        onResponse: function(data, response) {
          response.jsonp('adapter OK', 200);
        }
      })
    };

    var connection;
    var application;
    var server;
    var backend;

    setup(function(done) {
      utils.setupApplication()
        .next(function(result) {
          backend = result.backend;
          server = result.server;
          connection = result.connection;
          application = result.application;
          done();
        });
    });

    teardown(function() {
      utils.teardownApplication({ backend:    backend,
                                  server:     server,
                                  connection: connection });
    });

    test('to the document root', function(done) {
      httpAdapter.register(application, {
        prefix:     '',
        connection: connection,
        plugins:    [
          api.API_REST,
          api.API_SOCKET_IO,
          api.API_GROONGA,
          api.API_DROONGA,
          testPlugin
        ]
      });

      backend.reserveResponse(function(request) {
        return utils.createReplyPacket(request,
                                       {
                                         statusCode: 200,
                                         body:       'Adapter response',
                                       });
      });

      utils.get('/path/to/adapter')
        .next(function(response) {
          backend.assertReceived([{ type: 'adapter',
                                    body: 'adapter requested' }]);
          assert.deepEqual(response,
                          { statusCode: 200,
                            body:       JSON.stringify('adapter OK') });
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      httpAdapter.register(application, {
        prefix:     '/path/to/droonga',
        connection: connection,
        plugins:    [
          api.API_REST,
          api.API_SOCKET_IO,
          api.API_GROONGA,
          api.API_DROONGA,
          testPlugin
        ]
      });

      backend.reserveResponse(function(request) {
        return utils.createReplyPacket(request,
                                       {
                                         statusCode: 200,
                                         body:       'Adapter response',
                                       });
      });

      utils.get('/path/to/droonga/path/to/adapter')
        .next(function(response) {
          backend.assertReceived([{ type: 'adapter',
                                    body: 'adapter requested' }]);
          assert.deepEqual(response,
                          { statusCode: 200,
                            body:       JSON.stringify('adapter OK') });
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });

  suite('default commands', function() {
    var server;

    teardown(function() {
      if (server) {
        server.close();
        server = undefined;
      }
    });

    test('search', function(done) {
      var receiverCallback = {};
      var connection = utils.createStubbedBackendConnection();
      var application = express();
      httpAdapter.register(application, {
        prefix:     '',
        connection: connection,
        plugins: [
          api.API_REST,
          api.API_SOCKET_IO,
          api.API_GROONGA,
          api.API_DROONGA
        ]
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
                condition: {
                  query: 'bar'
                },
                output: {
                  elements: utils.allElements,
                  attributes: []
                }
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

    test('droonga', function(done) {
      var receiverCallback = {};
      var connection = utils.createStubbedBackendConnection();
      var application = express();
      httpAdapter.register(application, {
        prefix:     '',
        connection: connection,
        plugins: [
          api.API_REST,
          api.API_SOCKET_IO,
          api.API_GROONGA,
          api.API_DROONGA
        ]
      });
      var searchQueries = {
        source: 'table',
        condition: { query: '検索', matchTo: ['body'] }
      };
      utils.setupServer(application)
        .next(function(newServer) {
          server = newServer;
          utils.post('/droonga/search', JSON.stringify({ queries: searchQueries }));
        })
        .wait(0.1)
        .next(function() {
          assert.equal(1, connection.emitMessageCalledArguments.length);
          var args = connection.emitMessageCalledArguments[0];
          assert.equal(args.type, 'search');

          var expected = {
            queries: searchQueries,
            timeout: 1000,
            type:    'droonga-search'
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

