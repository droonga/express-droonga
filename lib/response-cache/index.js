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
  options.rules.forEach(function(rule) {
    normalizeTTLOption(rule);
  });

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

function Cache(options) {
  options = normalizeCacheOptions(options);
  var cache = this.cache = createCache({
    size: options.size
  });

  this.isCachableRequest = function(request) {
    return request.method == 'GET';
  };

  this.Entry = function ResponseCacheEntry(key) {
    this.key = key;
    this.data = {
      status:  0,
      headers: {},
      body:    []
    };
  };
  this.Entry.prototype = {
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
      var self = this;

      var originalWrite = response.write;
      response.write = function(chunk, encoding) {
        self.write(chunk, encoding);
        return originalWrite.call(response, chunk, encoding);
      };

      var originalEnd = response.end;
      response.end = function(chunk, encoding) {
        self.write(chunk, encoding);
        var returnValue = originalEnd.call(response, chunk, encoding);

        self.finalize(response);
        if (self.cachable) {
          cache.set(self.key, self.data, options.ttlInMilliSeconds);
        }

        return returnValue;
      };
    }
  };
}
Cache.prototype = {
  'get': function(key, callback) {
    return this.cache.get(key, callback);
  },
  'set': function(key, value, ttl, callback) {
    return this.cache.set(key, value, ttl, callback);
  }
};

exports = module.exports = function(options) {
  var cache = new Cache(options);

  return function(request, response, next) {
    if (!cache.isCachableRequest(request)) {
      next();
      return;
    }

    var cacheKey = generateKey(request);
    cache.get(cacheKey, function(error, cachedResponse) {
      if (error) {
        console.error(error);
        return;
      }

      if (cachedResponse) {
        sendCachedResponse(response, cachedResponse);
      } else {
        var entry = new cache.Entry(cacheKey);
        entry.hook(response);
        next();
      }
    });
  };
};
