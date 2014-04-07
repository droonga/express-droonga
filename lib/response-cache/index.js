var Entry = require('./entry');

function generateKey(request) {
  return request.method + '\n' + request.url;
}

function sendCachedResponse(response, cached) {
  response.statusCode = cached.status;
  Object.keys(cached.headers).forEach(function(key) {
    response.setHeader(key, cached.headers[key]);
  });
  response.setHeader('X-Droonga-Cached', 'yes');
  cached.body.forEach(function(chunk) {
    response.write(chunk.data, chunk.encoding);
  });
  response.end();
}

module.exports.Cache = require('./cache');

module.exports.statisticsMiddleware = function statisticsMiddleware(cache) {
  return function(request, response, next) {
    response.jsonp(200, cache.getStatistics());
  }
}

module.exports.middleware = function middleware(cache) {
  return function(request, response, next) {
    var rule = cache.getRule(request);
    if (!rule) {
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
        var entry = new Entry();
        entry.hook(response, function(cachedResponse) {
          cache.set(cacheKey, cachedResponse, rule.ttlInMilliSeconds);
        });
        next();
      }
    });
  };
};
