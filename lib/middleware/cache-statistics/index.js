module.exports = function middleware(cache) {
  return function(request, response, next) {
    response.status(200).jsonp(cache.getStatistics());
  }
}
