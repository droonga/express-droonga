var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../test-utils');

var express = require('express');
var httpAdapter = require('../../lib/adapter/http');
var command = require('../../lib/adapter/command');
var restAPI = require('../../lib/adapter/api/rest');
var groongaAPI = require('../../lib/adapter/api/groonga');

suite('HTTP Adapter', function() {
  test('registeration of plugin commands', function() {
    var basePlugin = {
      getCommand: new command.HTTPCommand({
        path: '/get'
      }),
      putCommand: new command.HTTPCommand({
        method: 'PUT',
        path: '/put'
      }),
      postCommand: new command.HTTPCommand({
        method: 'POST',
        path: '/post'
      }),
      deleteCommand: new command.HTTPCommand({
        method: 'DELETE',
        path: '/delete'
      }),
      ignored: new command.SocketCommand()
    };
    var overridingPlugin = {
      postCommand: new command.HTTPCommand({
        method: 'POST',
        path: '/post/overridden'
      }),
      deleteCommand: new command.HTTPCommand({
        method: 'DELETE',
        path: '/delete/overridden'
      })
    };

    var application = express();
    var registeredCommands = httpAdapter.register(application, {
      prefix:     '',
      connection: utils.createStubbedBackendConnection(),
      plugins: [
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
      adapter: new command.HTTPCommand({
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
        plugins:    [testPlugin]
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
        plugins:    [testPlugin]
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

