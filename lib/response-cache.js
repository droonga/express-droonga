exports = module.exports = function() {
  return function(request, response, next) {
    var originalWrite = response.write;
    var originalEnd = response.end;

    response.write = function(chunk, encoding) {
      return originalWrite.call(response, chunk, encoding);
    };

    response.end = function(chunk, encoding) {
      return originalEnd.call(response, chunk, encoding);
    };
  };
};
