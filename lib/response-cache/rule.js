var Entry = require('./entry');

function Rule(rule, options) {
  options = options || {};
  this.regex = rule.regex;
  this.ttlInMilliSeconds = rule.ttlInMilliSeconds || options.ttlInMilliSeconds || 0;
}
Rule.prototype = {
  match: function(request) {
    return this.regex.test(request.url);
  },
  createEntry: function() {
    return new Entry(this.ttlInMilliSeconds);
  }
};
exports = module.exports = Rule;
