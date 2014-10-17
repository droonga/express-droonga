var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('../test-utils');

var express = require('express');
var httpAdapter = require('../../lib/adapter/http');
var command = require('../../lib/adapter/command');
var api = require('../../lib/adapter/api');
var restAPI = require('../../lib/adapter/api/rest');
var droongaAPI = require('../../lib/adapter/api/droonga');
var groongaAPI = require('../../lib/adapter/api/groonga');

suite('HTTP Adapter', function() {
  test('registration of plugin commands', function() {
    var application = express();
    var registeredCommands = httpAdapter.register(application, {
      prefix:     '',
      connections: utils.createStubbedBackendConnections(),
      plugins: [
        api.API_REST,
        api.API_SOCKET_IO,
        api.API_GROONGA,
        api.API_DROONGA
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
                      { name:       'groonga-post',
                        definition: groongaAPI['groonga-post'] },
                      { name:       'droonga-get',
                        definition: droongaAPI['droonga-get'] },
                      { name:       'droonga-post',
                        definition: droongaAPI['droonga-post'] },
                      { name:       'droonga-streaming:watch',
                        definition: droongaAPI["droonga-streaming:watch"] }]);
  });

  suite('registration', function() {
    var testPlugin = {
      adapter: new command.HTTPRequestResponse({
        path: '/path/to/adapter',
        onRequest: function(request, connection) {
          connection.emit('adapter', 'adapter requested');
        },
        onResponse: function(data, response) {
          response.status(200).jsonp('adapter OK');
        }
      })
    };

    var connections;
    var application;
    var server;
    var backend;

    setup(function(done) {
      utils.setupApplication()
        .then(function(result) {
          backend = result.backend;
          server = result.server;
          connections = result.connections;
          application = result.application;
          done();
        })
        .catch(done);
    });

    teardown(function() {
      utils.teardownApplication({ backend:    backend,
                                  server:     server,
                                  connections: connections });
    });

    test('to the document root', function(done) {
      httpAdapter.register(application, {
        prefix:     '',
        connections: connections,
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
        .then(function(response) {
          backend.assertReceived([{ type: 'adapter',
                                    body: 'adapter requested' }]);
          assert.deepEqual(response,
                          { statusCode: 200,
                            body:       JSON.stringify('adapter OK') });
          done();
        })
        .catch(done);
    });

    test('under specified path', function(done) {
      httpAdapter.register(application, {
        prefix:     '/path/to/droonga',
        connections: connections,
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
        .then(function(response) {
          backend.assertReceived([{ type: 'adapter',
                                    body: 'adapter requested' }]);
          assert.deepEqual(response,
                          { statusCode: 200,
                            body:       JSON.stringify('adapter OK') });
          done();
        })
        .catch(done);
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
      var connections = utils.createStubbedBackendConnections();
      var connection = connections.get();
      var application = express();
      httpAdapter.register(application, {
        prefix:     '',
        connections: connections,
        plugins: [
          api.API_REST
        ]
      });
      utils.setupServer(application)
        .then(function(newServer) {
          server = newServer;
        })
        .then(utils.getCb('/tables/Store?query=NY'))
        .then(function() {
          assert.equal(1, connection.emitMessageCalledArguments.length);
          var args = connection.emitMessageCalledArguments[0];
          assert.equal(args.type, 'search');

          var expected = {
            queries: {
              stores: {
                source: 'Store',
                condition: {
                  query: 'NY'
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
        .catch(done);
    });

    test('droonga', function(done) {
      var receiverCallback = {};
      var connections = utils.createStubbedBackendConnections();
      var connection = connections.get();
      var application = express();
      httpAdapter.register(application, {
        prefix:     '',
        connections: connections,
        plugins: [
          api.API_DROONGA
        ]
      });
      var searchQueries = {
        source: 'table',
        condition: { query: '検索', matchTo: ['body'] }
      };
      utils.setupServer(application)
        .then(function(newServer) {
          server = newServer;
        })
        .then(utils.postCb('/droonga/search', JSON.stringify({ queries: searchQueries })))
        .then(function() {
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
        .catch(done);
    });
  });

  suite('multiple backends', function() {
    var testPlugin = {
      adapter: new command.HTTPRequestResponse({
        path: '/endpoint',
        onRequest: function(request, connection) {
          connection.emit('adapter', 'requested ' + request.query.id);
        },
        onResponse: function(data, response) {
          response.status(200).jsonp('OK');
        }
      })
    };

    var server;

    teardown(function() {
      if (server) {
        server.close();
        server = undefined;
      }
    });

    test('search', function(done) {
      var receiverCallback = {};
      var connections = utils.createStubbedBackendConnections(3);
      var application = express();
      httpAdapter.register(application, {
        prefix:     '',
        connections: connections,
        plugins: [
          testPlugin
        ]
      });
      utils.setupServer(application)
        .then(function(newServer) {
          server = newServer;
        })
        .then(utils.getCb('/endpoint?id=1'))
        .then(utils.getCb('/endpoint?id=2'))
        .then(utils.getCb('/endpoint?id=3'))
        .then(utils.getCb('/endpoint?id=4'))
        .then(function() {
          assert.deepEqual(
            connections.connections.map(function(connection) {
              return connection.emitMessageCalledArguments.map(function(args) {
                return {
                  type:    args.type,
                  message: args.message
                };
              });
            }),
            [
              [{ type: 'adapter', message: 'requested 1' },
               { type: 'adapter', message: 'requested 4' }],
              [{ type: 'adapter', message: 'requested 2' }],
              [{ type: 'adapter', message: 'requested 3' }]
            ]
          );
          done();
        })
        .catch(done);
    });
  });
});

