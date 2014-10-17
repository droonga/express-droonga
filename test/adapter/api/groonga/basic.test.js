var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('../../../test-utils');
var groongaUtils = require('./utils');

var express = require('express');
var httpAdapter = require('../../../../lib/adapter/http');
var groongaAPI = require('../../../../lib/adapter/api/groonga');

suite('adapter/api/groonga: basic commands', function() {
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
        httpAdapter.register(application, {
          prefix: '',
          connections: connections,
          plugins: [groongaAPI]
        });
        done();
      })
      .catch(done);
  });

  teardown(function() {
    utils.teardownApplication({
      backend:    backend,
      server:     server,
      connections: connections
    });
  });

  suite('URL suffix', function() {
    test('nothing', function(done) {
      groongaUtils.pushSuccessResponse(backend);
      var body = [
      ]
      utils.get('/d/table_create?name=Users', JSON.stringify(body))
        .then(function(response) {
          assert.deepEqual(response.statusCode, 200);
          done();
        })
        .catch(done);
    });

    test('.json', function(done) {
      groongaUtils.pushSuccessResponse(backend);
      var body = [
      ]
      utils.get('/d/table_create.json?name=Users', JSON.stringify(body))
        .then(function(response) {
          assert.deepEqual(response.statusCode, 200);
          done();
        })
        .catch(done);
    });
  });
});
