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

    test('mached to a rule', function() {
      var cache = new Cache({
        rules: [
          { regex: /foo/ }
        ]
      });
      var stubRequest = {
        method: 'GET',
        url:    'fooooo'
      };
      var rule = cache.getRule(stubRequest);
      assert.isNotNull(rule);
      assert.deepEqual(rule.regex, /foo/);
    });

    test('mached to multiple rules', function() {
      var primaryRegex = /foo/;
      var secondaryRegex = /foobar/;
      var cache = new Cache({
        rules: [
          { regex: primaryRegex },
          { regex: secondaryRegex },
        ]
      });
      var stubRequest = {
        method: 'GET',
        url:    'foobar'
      };
      var rule = cache.getRule(stubRequest);
      assert.isNotNull(rule);
      assert.deepEqual(rule.regex, primaryRegex);
    });
  });

  suite('statistics', function() {
    var cache;
    setup(function() {
      cache = new Cache({
        rules: [
          { regex: /.*/ }
        ]
      });
    });

    test('nGets', function() {
      assert.equal(cache.getStatistics().nGets, 0);
      cache.get('key', function(error, cachedResponse) {
      });
      assert.equal(cache.getStatistics().nGets, 1);
    });

    test('nHits', function() {
      cache.set('key', 'value');
      assert.equal(cache.getStatistics().nHits, 0);
      cache.get('key', function(error, cachedResponse) {
      });
      assert.equal(cache.getStatistics().nHits, 1);
    });

    suite('hitRatio', function() {
      test('0 gets', function() {
        assert.equal(cache.getStatistics().hitRatio, 0.0);
      });

      test('0 hits', function() {
        cache.get('key', function(error, cachedResponse) {
        });
        assert.equal(cache.getStatistics().hitRatio, 0.0);
      });

      test('1/2 hits', function() {
        cache.get('key', function(error, cachedResponse) {
        });
        cache.set('key', 'value');
        cache.get('key', function(error, cachedResponse) {
        });
        assert.equal(cache.getStatistics().hitRatio, 50.0);
      });
    });
  });
});

