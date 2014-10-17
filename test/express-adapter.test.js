var assert = require('chai').assert;
var nodemock = require('nodemock');
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
    var backend;
    var connection;
    var application;
    var server;

    setup(function(done) {
      utils.setupApplication()
        .then(function(result) {
          backend = result.backend;
          server = result.server;
          connection = result.connection;
          application = result.application;
          done();
        })
        .catch(done);
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
        .then(function(response) {
          assert.deepEqual(response,
                           { statusCode: 200,
                             body:       JSON.stringify('api OK') });
          done();
        })
        .catch(done);
    });

    test('under specified path', function(done) {
      application.droonga({
        prefix:     '/path/to/droonga',
        connection: connection,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var responseBody;
      utils.get('/path/to/droonga/path/to/api')
        .then(function(response) {
          responseBody = response.body;
        });

      utils.wait(0.01)
        .then(function() {
          backend.assertReceived([{ type: 'api',
                                    body: 'api requested' }]);

          return backend.sendResponse(backend.getMessages()[0],
                                      'api.result',
                                      'api OK?');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
          assert.equal(responseBody, JSON.stringify('api OK'));
          done();
        })
        .catch(done);
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
        .then(function(result) {
          backend = result.backend;
          server = result.server;
          connection = result.connection;
          application = result.application;
          done();
        })
        .catch(done);
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
        .then(function(newClient) {
          clientSocket = newClient.socket;
          clientSocket.emit('api', 'request');
        })
        .then(utils.waitCb(0.01))
        .then(function() {
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
        .then(utils.waitCb(0.01))
        .then(function() {
          mockedReceiver.assertThrows();
          done();
        })
        .catch(done);
    });
  });
});

