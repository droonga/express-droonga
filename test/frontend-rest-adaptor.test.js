var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');

var express = require('express');
var restAdaptor = require('../lib/frontend/rest-adaptor');
var model = require('../lib/model');
var restCommands = require('../lib/frontend/default-commands/rest');
var Connection = require('../lib/backend/connection').Connection;

suite('REST API', function() {
  test('registeration of plugin commands', function() {
    var basePlugin = {
      getCommand: new model.REST({
        path: '/get',
        toBackend: function() {}
      }),
      putCommand: new model.REST({
        method: 'PUT',
        path: '/put',
        toBackend: function() {}
      }),
      postCommand: new model.REST({
        method: 'POST',
        path: '/post',
        toBackend: function() {}
      }),
      deleteCommand: new model.REST({
        method: 'DELETE',
        path: '/delete',
        toBackend: function() {}
      }),
      ignored: new model.SocketCommand()
    };
    var overridingPlugin = {
      postCommand: new model.REST({
        method: 'POST',
        path: '/post/overridden',
        toBackend: function() {}
      }),
      deleteCommand: new model.REST({
        method: 'DELETE',
        path: '/delete/overridden',
        toBackend: function() {}
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
        command: command.command,
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
        toBackend: function() { return 'api requested'; },
        toClient: function() { return 'api OK'; }
      }),
      customCommandAPI: new model.REST({
        command: 'custom',
        path: '/path/to/customCommandAPI',
        toBackend: function() { return 'customCommandAPI requested'; },
        toClient: function() { return 'customCommandAPI OK'; }
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

      restAdaptor.register(application, {
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

      restAdaptor.register(application, {
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

    test('custom command name', function(done) {
      var onReceive = {};
      connection
        .mock('emitMessage')
          .takes('custom',
                 'customCommandAPI requested',
                 function() {},
                 { 'timeout': null })
          .ctrl(2, onReceive);

      restAdaptor.register(application, {
        prefix:     '',
        connection: connection,
        plugins:    [testPlugin]
      });

      var responseBody;
      Deferred
        .wait(0.01)
        .next(function() {
          utils.get('/path/to/customCommandAPI')
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
          assert.equal(responseBody, 'customCommandAPI OK');
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

