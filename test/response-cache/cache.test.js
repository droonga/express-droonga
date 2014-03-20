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

  suite('getRule', function() {
    test('non-GET requests', function() {
      var cache = new Cache({
        rules: [
          { regex: /foo/ }
        ]
      });
      var stubRequest = {
        method: 'POST'
      };
      var rule = cache.getRule(stubRequest);
      assert.isNull(rule);
    });

    test('not mached', function() {
      var cache = new Cache({
        rules: [
          { regex: /foo/ }
        ]
      });
      var stubRequest = {
        method: 'GET',
        url:    'bar'
      };
      var rule = cache.getRule(stubRequest);
      assert.isNull(rule);
    });
  });
});

