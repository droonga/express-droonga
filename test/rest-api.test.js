var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var expressKotoumi = require('../lib/index');
var Connection = require('../lib/backend-adaptor').Connection;

suite('REST API', function() {
  var connection;
  var sender;
  var receiver;
  var server;

  function commonSetup() {
    connection = new Connection({
      tag:        'test',
      listenPort: utils.testServerPort,
      sender:     sender = utils.createMockedSender(),
      receiver:   receiver = utils.createMockedReceiver()
    });
    receiver.triggerConnect('test');
  }

  function commonTeardown() {
    if (server) {
      server.close();
    }
    connection = undefined;
    sender = undefined;
    receiver = undefined;
    server = undefined;
  }

  test('registeration for given handlers', function() {
    var mockedHandlers = nodemock.mock('search')
          .takes('fake connection')
          .returns(function() {});
    var application = express();
    application.kotoumi({
      prefix:     '',
      connection: 'fake connection',
      handlers:   mockedHandlers
    });
    mockedHandlers.assertThrows();
  });

  suite('registeration', function() {
    setup(commonSetup);
    teardown(commonTeardown);

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

