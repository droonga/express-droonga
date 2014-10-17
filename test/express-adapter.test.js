var assert = require('chai').assert;
var nodemock = require('nodemock');
var express = require('express');
var client = require('supertest');

var utils = require('./test-utils');

var adapter = require('../index');
var command = require('../lib/adapter/command');

suite('Adaption for express application', function() {
  var testRestPlugin = {
    api: new command.HTTPRequestResponse({
      path: '/path/to/api',
      onRequest: function(request, connection) {
        connection.emit('api', 'api requested');
      },
      onResponse: function(data, response) {
        response.status(200).jsonp('api OK');
      }
    })
  };
  var testSocketPlugin = {
    api: new command.SocketRequestResponse({
      onRequest: function(data, connection) {
        connection.emit('api', 'api requested');
      },
      onResponse: function(data, socket) {
        socket.emit('api.response', 'api OK');
      }
    })
  };

  suite('REST API registeration', function() {
    var connectionPool;
    var application;
    var server;

    setup(function(done) {
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server = result.server;
          application = result.application;
          done();
        })
        .catch(done);
    });

    teardown(function() {
      utils.teardownApplication({ server:     server,
                                  connectionPool: connectionPool });
    });

    test('to the document root', function(done) {
      application.droonga({
        prefix:     '',
        connectionPool: connectionPool,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      client(application)
        .get('/path/to/api')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          try {
            assert.deepEqual(
              connectionPool.emittedMessages,
              [
                [{ type: 'api', message: 'api requested' }]
              ]
            );
            assert.deepEqual(response.body, 'api OK');
          } catch(error) {
            return done(error);
          }
          done();
        });
    });

    test('under specified path', function(done) {
      application.droonga({
        prefix:     '/path/to/droonga',
        connectionPool: connectionPool,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      client(application)
        .get('/path/to/droonga/path/to/api')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          try {
            assert.deepEqual(
              connectionPool.emittedMessages,
              [
                [{ type: 'api', message: 'api requested' }]
              ]
            );
            assert.deepEqual(response.body, 'api OK');
          } catch(error) {
            return done(error);
          }
          done();
        });
    });
  });

  suite('Socket.IO API registeration', function() {
    var application;
    var connectionPool;
    var server;
    var clients;

    setup(function(done) {
      connectionPool = utils.createStubbedBackendConnectionPool();
      utils.setupApplication({ connectionPool: connectionPool })
        .then(function(result) {
          server = result.server;
          application = result.application;
          done();
        })
        .catch(done);
    });

    teardown(function() {
      if (clients) {
        clients.forEach(function(client) {
          client.socket.disconnect();
        });
        clients = undefined;
      }
      utils.teardownApplication({ server:     server,
                                  connectionPool: connectionPool });
    });

    test('request-response', function(done) {
      application.droonga({
        connectionPool: connectionPool,
        server:     server,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var mockedReceiver;
      utils.createClients(1)
        .then(function(newClients) {
          clients = newClients;
          clients[0].expectReceive('api.response', 'api OK');
          clients[0].socket.emit('api', 'request');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          clients[0].assertThrows();
          done();
        })
        .catch(done);
    });
  });
});

