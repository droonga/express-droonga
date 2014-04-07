var assert = require('chai').assert;

var Rule = require('../../../lib/middleware/cache/rule');

suite('middleware - cache - Rule', function() {
  suite('ttlInMilliSeconds', function() {
    test('default', function() {
      var rule = new Rule({ regex: /./, ttlInMilliSeconds: null });
      assert.equal(rule.ttlInMilliSeconds, 0);
    });

    test('specified', function() {
      var rule = new Rule({ regex: /./, ttlInMilliSeconds: 20 });
      assert.equal(rule.ttlInMilliSeconds, 20);
    });
  });

  suite('match', function() {
    test('matched', function() {
      var rule = new Rule({ regex: /foo/, ttlInMilliSeconds: 10 });
      assert.isTrue(rule.match({ url: 'foo' }));
    });

    test('not matched', function() {
      var rule = new Rule({ regex: /foo/, ttlInMilliSeconds: 10 });
      assert.isFalse(rule.match({ url: 'bar' }));
    });
  });
});

