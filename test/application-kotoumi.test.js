var assert = require('chai').assert;
var nodemock = require('nodemock');

var utils = require('./test-utils');

var express = require('express');
var Connection = require('../lib/backend-adaptor').Connection;

suite('REST API', function() {
  var connection;
  var sender;
  var receiver;
  var server;

  setup(function() {
    connection = new Connection({
      tag:        'test',
      listenPort: 3333,
      sender:     sender = utils.createMockedSender(),
      receiver:   receiver = utils.createMockedReceiver()
    });
    receiver.triggerConnect('test');
  });

  teardown(function() {
    if (server) {
      server.close();
    }
    connection = undefined;
    sender = undefined;
    receiver = undefined;
    server = undefined;
  });

  test('register to the document root', function(done) {
    var application = express();
    application.kotoumi({
      prefix: ''
    });
    server = utils.setupServer(application);

    utils
      .get('/tables/foobar')
      .next(function(response) {
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

