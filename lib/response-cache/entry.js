function Entry(key, ttlInMilliSeconds) {
  if (!key)
    throw new Error('invalid cache key');

  if (!ttlInMilliSeconds)
    throw new Error('invalid TTL');

  this.key = key;
  this.ttlInMilliSeconds = ttlInMilliSeconds;
  this.data = {
    status:  0,
    headers: {},
    body:    []
  };
};
Entry.prototype = {
  isCachable: function() {
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

  hook: function(response, onEndCallback) {
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
      if (entry.isCachable())
        onEndCallback(entry.data, entry.ttlInMilliSeconds);

      return returnValue;
    };
  }
};
exports = module.exports = Entry;
