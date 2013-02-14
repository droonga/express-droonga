var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');

var express = require('express');
var restAdaptor = require('../lib/frontend/rest-adaptor');
var model = require('../lib/model');
var restCommands = require('../lib/frontend/default-commands/rest');

suite('REST API', function() {
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
    var registeredCommands = restAdaptor.register(application, {
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
      api: new model.REST({
        path: '/path/to/api',
        toBackend: function(event, request) { return [event, 'api requested']; },
        toClient: function(event, data) { return [event, 'api OK']; }
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
      restAdaptor.register(application, {
        prefix:     '',
        connection: connection,
        plugins:    [testPlugin]
      });

      var mockedReceiver = nodemock
            .mock('receive')
              .takes('api OK');

      utils.get('/path/to/api')
        .next(function(response) {
          mockedReceiver.receive(response.body);
        });

      Deferred
        .wait(0.01)
        .next(function() {
          backend.assertReceived([{ type: 'api',
                                    body: 'api requested' }]);

          return backend.sendResponse(backend.getMessages()[0],
                                      'api.result',
                                      'api OK?');
        })
        .wait(0.01)
        .next(function() {
          mockedReceiver.assertThrows();
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      restAdaptor.register(application, {
        prefix:     '/path/to/kotoumi',
        connection: connection,
        plugins:    [testPlugin]
      });

      var mockedReceiver = nodemock
            .mock('receive')
              .takes('api OK');

      utils.get('/path/to/kotoumi/path/to/api')
        .next(function(response) {
          mockedReceiver.receive(response.body);
        });

      Deferred
        .wait(0.01)
        .next(function() {
          backend.assertReceived([{ type: 'api',
                                    body: 'api requested' }]);

          return backend.sendResponse(backend.getMessages()[0],
                                      'api.result',
                                      'api OK?');
        })
        .wait(0.01)
        .next(function() {
          mockedReceiver.assertThrows();
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

