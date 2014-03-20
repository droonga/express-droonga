var createCache = require('uber-cache');

var defaultSize              = 100;
var defaultTTLInMilliSeconds = 60 * 1000;

function normalizeTTLOption(options) {
  var ttlInSeconds = options.ttlInSeconds || 0;
  options.ttlInMilliSeconds = options.ttl ||
                                options.ttlInMilliSeconds ||
                                (ttlInSeconds * 1000) ||
                                defaultTTLInMilliSeconds;
}

function normalizeCacheOptions(options) {
  options = options || {};

  options.rules = options.rules || [];
  options.size = options.size || defaultSie;
  normalizeTTLOption(options);

  options.rules = options.rules.map(function(rule) {
    normalizeTTLOption(rule);
    return new Rule(rule, options);
  });

  return options;
}

function Cache(options) {
  options = normalizeCacheOptions(options);
  var cache = this.cache = createCache({
    size: options.size
  });

  this.rules = options.rules;
  this.rules.forEach(function(rule) {
    rule.cache = cache;
  });
}
Cache.prototype = {
  'get': function(key, callback) {
    return this.cache.get(key, callback);
  },

  'set': function(key, value, ttl, callback) {
    return this.cache.set(key, value, ttl, callback);
  },

  getRule: function(request) {
    if (request.method != 'GET')
      return null;

    var foundRule = null;
    this.rules.some(function(rule) {
      if (rule.match(request))
        return foundRule = rule;
    });
    return foundRule;
  };
};
exports = module.exports = Cache;

function Rule(rule, options) {
  this.regex = rule.regex;
  this.ttlInMilliSeconds = rule.ttlInMilliSeconds || options.ttlInMilliSeconds;

  var self = this;

  this.CacheEntry = function CacheEntry(key) {
    if (!key)
      throw new Error('invalid cache key');

    this.key = key;
    this.data = {
      status:  0,
      headers: {},
      body:    []
    };
  };
  this.CacheEntry.prototype = {
    get cachable() {
      return this.data.status == 200;
    },

    write: function(chunk, encoding) {
      this.data.body.push({
        data:     chunk,
        encoding: encoding
      });
    },

    finalize: function(response) {
      this.data.status = response.statusCode;
      this.data.headers = response.headers;
    },

    hook: function(response) {
      var entry = this;

      var originalWrite = response.write;
      response.write = function(chunk, encoding) {
        entry.write(chunk, encoding);
        return originalWrite.call(response, chunk, encoding);
      };

      var originalEnd = response.end;
      response.end = function(chunk, encoding) {
        entry.write(chunk, encoding);
        var returnValue = originalEnd.call(response, chunk, encoding);

        entry.finalize(response);
        entry.store();
        return returnValue;
      };
    },

    store: function() {
      if (!this.cachable)
        return;

      if (!this.cache)
        throw new Error('no cache storage');

      this.cache.set(this.key, this.data, this.ttlInMilliSeconds);
    }
  };
}
