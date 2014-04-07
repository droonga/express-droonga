module.exports = function middleware(cache) {
  return function(request, response, next) {
    response.jsonp(200, cache.getStatistics());
  }
}
