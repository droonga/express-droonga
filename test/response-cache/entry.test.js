var assert = require('chai').assert;
var nodemock = require('nodemock');

var Entry = require('../../lib/response-cache/entry');

suite('Response Cache Entry', function() {
  suite('isCachable', function() {
    test('not processed', function() {
      var entry = new Entry('key', 10, {});
      assert.isFalse(entry.isCachable());
    });

    test('success', function() {
      var entry = new Entry('key', 10, {});
      entry.data.status = 200;
      assert.isTrue(entry.isCachable());
    });

    test('error', function() {
      var entry = new Entry('key', 10, {});
      entry.data.status = 400;
      assert.isFalse(entry.isCachable());
    });
  });

  test('store', function() {
    var ttl = 10;
    var value = true;
    var mockedStorage = nodemock.mock('set').takes('key', { status: 200, headers: {}, body: [] }, ttl);

    var entry = new Entry('key', ttl, mockedStorage);
    entry.data.status = 200;
    entry.store();
    mockedStorage.assertThrows();
  });
});

