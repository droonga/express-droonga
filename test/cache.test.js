var assert = require('chai').assert;

var Cache = require('../lib/cache');

suite('Cache', function() {
  suite('statistics', function() {
    var cache;
    setup(function() {
      cache = new Cache();
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

