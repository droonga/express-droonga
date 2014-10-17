var assert = require('chai').assert;

var utils = require('../test-utils');

var ConnectionPool = require('../../lib/droonga-protocol/connection-pool').ConnectionPool;

suite('ConnectionPool', function() {
  suite('initialization', function() {
    var connectionPool;

    teardown(function() {
      if (connectionPool) {
        connectionPool.closeAll();
        connectionPool = undefined;
      }
    });

    test('single', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1'
        ]
      });
      assert.equal(connectionPool.count, 1);
    });

    test('multiple', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1',
          '127.0.0.2'
        ]
      });
      assert.equal(connectionPool.count, 2);
    });

    test('duplicated', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1',
          '127.0.0.1'
        ]
      });
      assert.equal(connectionPool.count, 1);
    });
  });

  suite('get', function() {
    var connectionPool;

    teardown(function() {
      if (connectionPool) {
        connectionPool.closeAll();
        connectionPool = undefined;
      }
    });

    test('single', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1'
        ]
      });
      var connection = connectionPool.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.1');
    });

    test('multiple', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1',
          '127.0.0.2',
          '127.0.0.3'
        ]
      });
      var connection = connectionPool.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.1');

      connection = connectionPool.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.2');

      connection = connectionPool.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.3');

      connection = connectionPool.get();
      assert.isNotNull(connection);
      assert.equal(connection.hostName, '127.0.0.1');
    });
  });
});
