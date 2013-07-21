var util = require('util');

var debug;
if (process.env.NODE_DEBUG && /express-droonga/.test(process.env.NODE_DEBUG)) {
  debug = function() {
    console.error('express-droonga:',
                  util.format.apply(util, arguments));
  };
} else {
  debug = function() {};
}

module.exports = debug;
