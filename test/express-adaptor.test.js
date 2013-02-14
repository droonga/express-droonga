var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;
var express = require('express');

var utils = require('./test-utils');

var adaptor = require('../index');
var model = require('../lib/model');
var Connection = require('../lib/backend/connection').Connection;

suite('Adaption for express application', function() {
  var testRestPlugin = {
    api: new model.REST({
      path: '/path/to/api',
      toBackend: function(event, request) { return [event, 'api requested']; },
      toClient: function(event, data) { return [event, 'api OK']; }
    })
  };
  var testSocketPlugin = {
    api: new model.SocketRequestResponse({
      toBackend: function(event, data) { return [event, 'api requested']; },
      toClient: function(event, data) { return [event, 'api OK']; }
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
      application.kotoumi({
        prefix:     '',
        connection: connection,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var responseBody;
      utils.get('/path/to/api')
        .next(function(response) {
          responseBody = response.body;
        });

      Deferred
        .wait(0.01)
        .next(function() {
          assert.deepEqual(backend.getMessages().map(function(message) {
                             return { type: message.type,
                                      body: message.body };
                           }),
                           [{ type: 'api',
                              body: 'api requested' }]);

          var request = backend.getMessages()[0];
          var response = utils.createReplyEnvelope(request,
                                                   'api.result',
                                                   'api OK?');
          return utils.sendPacketTo(utils.createPacket(response),
                                    utils.testReceivePort)
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
      application.kotoumi({
        prefix:     '/path/to/kotoumi',
        connection: connection,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var responseBody;
      utils.get('/path/to/kotoumi/path/to/api')
        .next(function(response) {
          responseBody = response.body;
        });

      Deferred
        .wait(0.01)
        .next(function() {
          assert.deepEqual(backend.getMessages().map(function(message) {
                             return { type: message.type,
                                      body: message.body };
                           }),
                           [{ type: 'api',
                              body: 'api requested' }]);

          var request = backend.getMessages()[0];
          var response = utils.createReplyEnvelope(request,
                                                   'api.result',
                                                   'api OK?');
          return utils.sendPacketTo(utils.createPacket(response),
                                    utils.testReceivePort)
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
      application.kotoumi({
        connection: connection,
        server:     server,
        plugins:    [testRestPlugin, testSocketPlugin]
      });

      var mockedReceiver;
      utils.createClientSocket()
        .next(function(newClientSocket) {
          clientSocket = newClientSocket;
          clientSocket.emit('api', 'request');
        })
        .wait(0.01)
        .next(function() {
          assert.deepEqual(backend.getMessages().map(function(message) {
                             return { type: message.type,
                                      body: message.body };
                           }),
                           [{ type: 'api',
                              body: 'api requested' }]);

          mockedReceiver = nodemock
            .mock('receive')
              .takes('api OK');
          clientSocket.on('api.result', function(data) {
            mockedReceiver.receive(data);
          });

          var request = backend.getMessages()[0];
          var response = utils.createReplyEnvelope(request,
                                                   'api.result',
                                                   'api OK?');
          return utils.sendPacketTo(utils.createPacket(response),
                                    utils.testReceivePort)
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

