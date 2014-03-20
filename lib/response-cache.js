var createCache = require('uber-cache');

function generateKey(request) {
  return request.method + '\n' + request.url;
}

function sendCachedResponse(response, cached) {
  response.statusCode = cached.status;
  Object.keys(cached.headers).forEach(function(key) {
    response.setHeader(key, cached.headers[key]);
  });
  cached.body.forEach(function(chunk) {
    response.write(chunk.data, chunk.encoding);
  });
  response.end();
}

function ResponseCacheEntry(cache) {
  this.data = {
    status:  0,
    headers: {},
    body:    []
  };
}
ResponseCacheEntry.prototype = {
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
  }
};

exports = module.exports = function(options) {
  options = options || {};

  var size = options.size || 100;
  var ttlInSeconds = options.ttl || options.ttlInSeconds || 60;
  var ttlInMilliSeconds = options.ttlInMilliSeconds || (ttlInSeconds * 1000);

  var cache = createCache({
    size: size
  });

  return function(request, response, next) {
    if (request.method != 'GET') {
      next();
      return;
    }

    var originalWrite = response.write;
    var originalEnd = response.end;

    var cacheKey = generateKey(request);
    cache.get(cacheKey, function(error, cachedResponse) {
      if (error) {
        console.error(error);
        return;
      }

      if (cachedResponse) {
        sendCachedResponse(response, cachedResponse);
        return;
      }

      var entry = new ResponseCacheEntry();

      response.write = function(chunk, encoding) {
        entry.write(chunk, encoding);
        return originalWrite.call(response, chunk, encoding);
      };

      response.end = function(chunk, encoding) {
        entry.write(chunk, encoding);
        var returnValue = originalEnd.call(response, chunk, encoding);

        entry.finalize(response);
        if (entry.cachable) {
          cache.set(cacheKey, entry.data, ttlInMilliSeconds);
        }

        return returnValue;
      };
    });
  };
};
