var UbserCache = require('uber-cache');

var defaultSize = 100;

function normalizeOptions(options) {
  options = options || {};

  options.size = options.size || defaultSize;

  return options;
}

function Cache(options) {
  options = normalizeOptions(options);
  this.cache = new UbserCache({
    size: options.size
  });
  this.nGets = 0;
  this.nHits = 0;
}
Cache.prototype = {
  'get': function(key, callback) {
    return this.cache.get(key, function(error, cachedResponse) {
      this.nGets++;
      if (cachedResponse) {
        this.nHits++;
      }
      callback(error, cachedResponse);
    }.bind(this));
  },

  'set': function(key, value, ttl, callback) {
    return this.cache.set(key, value, ttl, callback);
  },

  getStatistics: function() {
    var hitRatio;
    if (this.nGets == 0) {
      hitRatio = 0.0;
    } else {
      hitRatio = (this.nHits / this.nGets) * 100;
    }
    return {
      "nGets": this.nGets,
      "nHits": this.nHits,
      "hitRatio": hitRatio
    };
  },

  clear: function(callack) {
    this.cache.clear(callack);
  }
};
module.exports = Cache;
