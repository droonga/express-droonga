var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var adaptor = require('../index');
var Connection = require('../lib/backend-adaptor').Connection;

suite('Adaption for express application', function() {
  suite('registeration', function() {
    function createHandlerFactory(type) {
      return function() {
        return function(request, response) {
          response.contentType('text/plain');
          response.send(type + ' OK', 200);
        };
      };
    }
    var handlersFactory = {
      search: createHandlerFactory('search')
    };

    var server;
    teardown(function() {
      if (server) {
        server.close();
      }
      server = undefined;
    });

    test('to the document root', function(done) {
      var application = express();
      application.kotoumi({
        prefix:     '',
        connection: 'fake connection',
        handlers:   handlersFactory
      });
      server = utils.setupServer(application);

      utils
        .get('/tables/foobar')
        .next(function(response) {
          assert.equal('search OK', response.body);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('under specified path', function(done) {
      var application = express();
      application.kotoumi({
        prefix:     '/path/to/kotoumi',
        connection: 'fake connection',
        handlers:   handlersFactory
      });
      server = utils.setupServer(application);

      utils
        .get('/path/to/kotoumi/tables/foobar')
        .next(function(response) {
          assert.equal('search OK', response.body);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });
});

