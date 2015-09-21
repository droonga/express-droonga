function Entry() {
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
    if (Buffer.isBuffer(chunk))
      chunk = chunk.toString();
    this.data.body.push({
      data:     chunk,
      encoding: encoding
    });
  },

  finalize: function(response) {
    this.data.status = response.statusCode;
    this.data.headers = response.headers || response._headers; // currently there is no public method to get all headers... why?
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
      entry.tryStore(onEndCallback);

      return returnValue;
    };
  },

  tryStore: function(callback) {
    if (this.isCachable())
      callback(this.data);
  }
};
module.exports = Entry;
