var createCache = require('uber-cache');

var defaultSize              = 100;
var defaultTTLInMilliSeconds = 60 * 1000;

function normalizeOptions(options) {
  options = options || {};

  options.size = options.size || defaultSie;

  var ttlInSeconds = options.ttl ||
                       options.ttlInSeconds ||
                       0;
  options.ttlInMilliSeconds = options.ttlInMilliSeconds ||
                                (ttlInSeconds * 1000) ||
                                defaultTTLInMilliSeconds;

  return options;
}

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
  options = normalizeOptions(options);

  var cache = createCache({
    size: options.size
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
          cache.set(cacheKey, entry.data, options.ttlInMilliSeconds);
        }

        return returnValue;
      };
    });
  };
};
