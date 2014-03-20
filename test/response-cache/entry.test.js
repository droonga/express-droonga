var assert = require('chai').assert;

var Entry = require('../../lib/response-cache/entry');

suite('Response Cache Entry', function() {
  suite('isCachable', function() {
    test('not processed', function() {
      var entry = new Entry();
      assert.isFalse(entry.isCachable());
    });

    test('success', function() {
      var entry = new Entry();
      entry.data.status = 200;
      assert.isTrue(entry.isCachable());
    });

    test('error', function() {
      var entry = new Entry();
      entry.data.status = 400;
      assert.isFalse(entry.isCachable());
    });
  });

  suite('tryStore', function() {
    test('success', function() {
      var entry = new Entry();
      entry.data.status = 200;
      var args = [];
      entry.tryStore(function() {
        args.push(Array.prototype.slice.call(arguments, 0));
      });
      assert.deepEqual(args, [[entry.data]]);
    });

    test('error', function() {
      var entry = new Entry();
      entry.data.status = 400;
      var args = [];
      entry.tryStore(function() {
        args.push(Array.prototype.slice.call(arguments, 0));
      });
      assert.deepEqual(args, []);
    });
  });
});

