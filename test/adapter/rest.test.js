var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../test-utils');

var express = require('express');
var httpAdapter = require('../../lib/adapter/http');
var model = require('../../lib/model');
var restCommands = require('../../lib/adapter/default-commands/rest');

suite('HTTP Adapter', function() {
  test('registeration of plugin commands', function() {
    var basePlugin = {
      getCommand: new model.REST({
        path: '/get'
      }),
      putCommand: new model.REST({
        method: 'PUT',
        path: '/put'
      }),
      postCommand: new model.REST({
        method: 'POST',
        path: '/post'
      }),
      deleteCommand: new model.REST({
        method: 'DELETE',
        path: '/delete'
      }),
      ignored: new model.SocketCommand()
    };
    var overridingPlugin = {
      postCommand: new model.REST({
        method: 'POST',
        path: '/post/overridden'
      }),
      deleteCommand: new model.REST({
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
                        definition: restCommands.search },
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
      adapter: new model.REST({
        path: '/path/to/adapter',
        toBackend: function(event, request) { return [event, 'adapter requested']; },
        toClient: function(event, data) { return [event, 'adapter OK']; }
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

