var assert = require('chai').assert;

var utils = require('../test-utils');

var Connections = require('../../lib/droonga-protocol/connections').Connections;

suite('Connections', function() {
  suite('initialization', function() {
    var connections;

    teardown(function() {
      if (connections) {
        connections.closeAll();
        connections = undefined;
      }
    });

    test('single', function() {
      connections = new Connections({
        hostNames: [
          '127.0.0.1'
        ]
      });
      assert.equal(connections.count, 1);
    });

    test('multiple', function() {
      connections = new Connections({
        hostNames: [
          '127.0.0.1',
          '127.0.0.2'
        ]
      });
      assert.equal(connections.count, 2);
    });

    test('duplicated', function() {
      connections = new Connections({
        hostNames: [
          '127.0.0.1',
          '127.0.0.1'
        ]
      });
      assert.equal(connections.count, 1);
    });
  });

  suite('get', function() {
    var connections;

    teardown(function() {
      if (connections) {
        connections.closeAll();
        connections = undefined;
      }
    });

    test('single', function() {
      connections = new Connections({
        hostNames: [
          '127.0.0.1'
        ]
      });
      var connection = connections.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.1');
    });

    test('multiple', function() {
      connections = new Connections({
        hostNames: [
          '127.0.0.1',
          '127.0.0.2',
          '127.0.0.3'
        ]
      });
      var connection = connections.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.1');

      connection = connections.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.2');

      connection = connections.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.3');

      connection = connections.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.1');
    });
  });
});
