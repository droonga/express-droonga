var Entry = require('./entry');

function Rule(rule, options) {
  this.regex = rule.regex;
  this.ttlInMilliSeconds = rule.ttlInMilliSeconds || options.ttlInMilliSeconds;
}
Rule.prototype = {
  match: function(request) {
    return this.regex.test(request.url);
  },
  createEntry: function(key) {
    return new Entry(key, this.ttlInMilliSeconds, this.cache);
  }
};
exports = module.exports = Rule;
