var assert = require('chai').assert;

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

  function createStubStorage() {
    return {
      'set': function() {
        this.args.push(Array.prototype.slice.call(arguments, 0));
      },
      args: []
    };
  };

  test('store', function() {
    var storage = createStubStorage();
    var entry = new Entry('key', 10, storage);
    entry.data.status = 200;
    entry.store();
    assert.deepEqual(storage.args, [['key', entry.data, 10]]);
  });

  suite('end', function() {
    test('success', function() {
      var storage = createStubStorage();
      var entry = new Entry('key', 10, storage);
      entry.data.status = 200;
      entry.store();
      assert.deepEqual(storage.args, [['key', entry.data, 10]]);
    });

    test('error', function() {
      var storage = createStubStorage();
      var entry = new Entry('key', 10, storage);
      entry.data.status = 400;
      entry.store();
      assert.deepEqual(storage.args, []);
    });
  });
});

