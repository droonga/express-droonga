var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../../../test-utils');

var express = require('express');
var httpAdapter = require('../../../../lib/adapter/http');
var groongaAPI = require('../../../../lib/adapter/api/groonga');

suite('adapter/api/groonga: load', function() {
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

  suite('success', function() {
    suite('n records', function() {
      test('zero', function(done) {
        pushSuccessResponse();
        var body = [
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            try {
              var responseBody = groongaResponseBody(response);
              assert.deepEqual(responseBody, [0]);
              done();
            } catch (error) {
              done(error);
            }
          });
      });

      test('one', function(done) {
        pushSuccessResponse();
        var body = [
          {
            _key: 'alice'
          }
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            try {
              var responseBody = groongaResponseBody(response);
              assert.deepEqual(responseBody, [1]);
              done();
            } catch (error) {
              done(error);
            }
          });
      });

      test('multiple', function(done) {
        pushSuccessResponse();
        pushSuccessResponse();
        var body = [
          {
            _key: 'alice'
          },
          {
            _key: 'bob'
          }
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            try {
              var responseBody = groongaResponseBody(response);
              assert.deepEqual(responseBody, [2]);
              done();
            } catch (error) {
              done(error);
            }
          });
      });
    });

    suite('object style', function() {
      test('no _key', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var body = [
          {
            title: 'Droonga',
            content: 'Droonga is fun!'
          }
        ]
        utils.post('/d/load?table=Memos', JSON.stringify(body))
          .next(function(response) {
            try {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Memos',
                                 values: {
                                   title: 'Droonga',
                                   content: 'Droonga is fun!'
                                 }
                               });
              done();
            } catch (error) {
              done(error);
            }
          });
      });

      test('with columns', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var body = [
          {
            _key: 'alice',
            name: 'Alice',
            age: 20
          }
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            try {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Users',
                                 key: 'alice',
                                 values: {
                                   name: 'Alice',
                                   age: 20
                                 }
                               });
              done();
            } catch (error) {
              done(error);
            }
          });
      });
    });
  });

  suite('failure', function() {
  });
});

