var Entry = require('./entry');
var Rule = require('./rule');

var defaultTTLInMilliSeconds = 60 * 1000;

var LOG_PREFIX = '[middleware-cache] ';

function getNormalizedTTLInMilliSeconds(options) {
  var ttlInSeconds = options.ttlInSeconds || 0;
  return options.ttl ||
           options.ttlInMilliSeconds ||
           (ttlInSeconds * 1000) ||
           0;
}

function validateRules(rules) {
  if (!Array.isArray(rules))
    throw new Error('rules must be an array');

  if (!rules.length)
    throw new Error('you must specify one or more rules');
}

function createRules(options) {
  var ttlInMilliSeconds =
    getNormalizedTTLInMilliSeconds(options) ||
    defaultTTLInMilliSeconds;

  validateRules(options.rules);

  return options.rules.map(function(rule) {
    rule.ttlInMilliSeconds = getNormalizedTTLInMilliSeconds(rule) ||
                               ttlInMilliSeconds;
    return new Rule(rule);
  });
}

function findRule(rules, request) {
  if (request.method != 'GET')
    return null;

  var foundRule = null;
  rules.some(function(rule) {
    if (rule.match(request))
      return foundRule = rule;
  });
  return foundRule;
}

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
    var data = new Buffer(chunk.data);
    response.write(data, chunk.encoding);
  });
  response.end();
}

module.exports = function cacheMiddleware(cache, options) {
  var rules = createRules(options);
  var logger = options.logger || console;

  return function(request, response, next) {
    var rule = findRule(rules, request);
    if (!rule) {
      next();
      return;
    }

    var cacheKey = generateKey(request);
    cache.get(cacheKey, function(error, cachedResponse) {
      if (error) {
        logger.error(LOG_PREFIX, error);
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
