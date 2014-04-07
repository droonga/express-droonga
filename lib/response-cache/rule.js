function Rule(rule, options) {
  options = options || {};

  if (!rule)
    throw new Error('no rule is given');
  if (!rule.regex)
    throw new Error('rule must have "regex"');

  this.regex = rule.regex;
  this.ttlInMilliSeconds = rule.ttlInMilliSeconds || options.ttlInMilliSeconds || 0;
}
Rule.prototype = {
  match: function(request) {
    return this.regex.test(request.url);
  }
};
module.exports = Rule;
