var Cache = require('./cache');

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
