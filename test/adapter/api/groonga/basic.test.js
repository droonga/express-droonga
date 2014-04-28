var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../../../test-utils');

var express = require('express');
var httpAdapter = require('../../../../lib/adapter/http');
var groongaAPI = require('../../../../lib/adapter/api/groonga');

suite('adapter/api/groonga: basic commands', function() {
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
        httpAdapter.register(application, {
          prefix: '',
          connection: connection,
          plugins: [groongaAPI]
        });
        done();
      });
  });

  teardown(function() {
    utils.teardownApplication({
      backend:    backend,
      server:     server,
      connection: connection
    });
  });

  var successMessage = {
    statusCode: 200,
    body:       true
  };

  function pushSuccessResponse() {
    backend.reserveResponse(function(requestPacket) {
      return utils.createReplyPacket(requestPacket, successMessage);
    });
  }

  function groongaResponse(responseMessage) {
    return JSON.parse(responseMessage.body);
  }

  function groongaResponseHeader(responseMessage) {
    return groongaResponse(responseMessage)[0];
  };

  function groongaResponseBody(responseMessage) {
    return groongaResponse(responseMessage)[1];
  };

  suite('URL suffix', function() {
    test('nothing', function(done) {
      pushSuccessResponse();
      var body = [
      ]
      utils.post('/d/table_create?name=Users', JSON.stringify(body))
        .next(function(response) {
          assert.deepEqual(response.statusCode, 200);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('.json', function(done) {
      pushSuccessResponse();
      var body = [
      ]
      utils.post('/d/table_create.json?name=Users', JSON.stringify(body))
        .next(function(response) {
          assert.deepEqual(response.statusCode, 200);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });
});
