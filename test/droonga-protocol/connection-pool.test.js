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
      var connections = [];
      var connection;

      connection = connectionPool.get();
      assert.isNotNull(connection);
      connections.push(connection);

      connection = connectionPool.get();
      assert.isNotNull(connection);
      connections.push(connection);

      connection = connectionPool.get();
      assert.isNotNull(connection);
      connections.push(connection);

      connection = connectionPool.get();
      assert.isNotNull(connection);
      connections.push(connection);

      connection = connectionPool.get();
      assert.isNotNull(connection);
      connections.push(connection);

      connection = connectionPool.get();
      assert.isNotNull(connection);
      connections.push(connection);

      assert.deepEqual([connections[0].hostName,
                        connections[1].hostName,
                        connections[2].hostName],
                       [connections[3].hostName,
                        connections[4].hostName,
                        connections[5].hostName]);
    });
  });

  suite('updating of hostNames', function() {
    var connectionPool;

    teardown(function() {
      if (connectionPool) {
        connectionPool.closeAll();
        connectionPool = undefined;
      }
    });

    test('no change', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1'
        ]
      });
      var beforeConnection = connectionPool.get();

      connectionPool.hostNames = ['127.0.0.1'];

      var afterConnection = connectionPool.get();
      assert.equal(afterConnection.hostName, beforeConnection.hostName);
      assert.isFalse(beforeConnection.closed);
    });

    test('replace', function() {
      connectionPool = new ConnectionPool({
        hostNames: [
          '127.0.0.1'
        ]
      });
      var beforeConnection = connectionPool.get();

      connectionPool.hostNames = ['127.0.0.2'];

      var afterConnection = connectionPool.get();
      assert.notEqual(afterConnection.hostName, beforeConnection.hostName);
      assert(beforeConnection.closed);
    });
  });
});
