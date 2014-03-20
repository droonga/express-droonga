var assert = require('chai').assert;

var Cache = require('../../lib/response-cache/cache');

suite('Response Cache', function() {
  suite('required parameters', function() {
    test('missing rules', function() {
      assert.throw(function() {
        var cache = new Cache({
        });
      }, Error);
    });

    test('not-array rules', function() {
      assert.throw(function() {
        var cache = new Cache({
          rules: {
            'foo' : {
              ttl: 10
            }
          }
        });
      }, Error);
    });
  });
});

