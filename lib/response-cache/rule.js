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

      if (!self.cache)
        throw new Error('no cache storage');

      self.cache.set(this.key, this.data, this.ttlInMilliSeconds);
    }
  };
}
