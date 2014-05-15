var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

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
        response.jsonp(200, 'api OK');
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
    var backend;
    var connection;
    var application;
    var server;

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
      application.droonga({
        prefix:     '',
        connection: connection,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      backend.reserveResponse(function(request) {
        return utils.createReplyPacket(request,
                                       {
                                         statusCode: 200,
                                         body:       'API response',
                                       });
      });

      utils.get('/path/to/api')
        .next(function(response) {
          backend.assertReceived([{ type: 'api',
                                    body: 'api requested' }]);
          assert.deepEqual(response,
                           { statusCode: 200,
                             body:       JSON.stringify('api OK') });
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      application.droonga({
        prefix:     '/path/to/droonga',
        connection: connection,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var responseBody;
      utils.get('/path/to/droonga/path/to/api')
        .next(function(response) {
          responseBody = response.body;
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
          assert.equal(responseBody, JSON.stringify('api OK'));
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });

  suite('Socket.IO API registeration', function() {
    var application;
    var connection;
    var server;
    var clientSocket;
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
      if (clientSocket) {
        clientSocket.disconnect();
        clientSocket = undefined;
      }
      utils.teardownApplication({ backend:    backend,
                                  server:     server,
                                  connection: connection });
    });

    test('request-response', function(done) {
      application.droonga({
        connection: connection,
        server:     server,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var mockedReceiver;
      utils.createClient()
        .next(function(newClient) {
          clientSocket = newClient.socket;
          clientSocket.emit('api', 'request');
        })
        .wait(0.01)
        .next(function() {
          backend.assertReceived([{ type: 'api',
                                    body: 'api requested' }]);

          mockedReceiver = nodemock
            .mock('receive')
              .takes('api OK');
          clientSocket.on('api.response', function(data) {
            mockedReceiver.receive(data);
          });

          return backend.sendResponse(backend.getMessages()[0],
                                      'api.response',
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
});

