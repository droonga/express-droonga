var assert = require('chai').assert;

var Rule = require('../../lib/response-cache/rule');

suite('Response Cache Rule', function() {
  suite('ttlInMilliSeconds', function() {
    test('default', function() {
      var rule = new Rule({ regex: null, ttlInMilliSeconds: null });
      assert.equal(rule.ttlInMilliSeconds, 0);
    });

    test('global', function() {
      var rule = new Rule({ regex: null, ttlInMilliSeconds: null },
                          { ttlInMilliSeconds: 10 });
      assert.equal(rule.ttlInMilliSeconds, 10);
    });

    test('local', function() {
      var rule = new Rule({ regex: null, ttlInMilliSeconds: 20 },
                          { ttlInMilliSeconds: 10 });
      assert.equal(rule.ttlInMilliSeconds, 20);
    });
  });
});

