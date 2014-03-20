function Entry(key, ttlInMilliSeconds, cache) {
  if (!key)
    throw new Error('invalid cache key');

  if (!ttlInMilliSeconds)
    throw new Error('invalid TTL');

  if (!cache)
    throw new Error('invalid storage');

  this.key = key;
  this.ttlInMilliSeconds = ttlInMilliSeconds;
  this.cache = cache;
  this.data = {
    status:  0,
    headers: {},
    body:    []
  };
};
Entry.prototype = {
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

    this.cache.set(this.key, this.data, this.ttlInMilliSeconds);
  }
};
exports = module.exports = Entry;
