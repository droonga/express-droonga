var http = require('http');
var socketIo = require('socket.io');
var fluent = require('fluent-logger');

function Connection(params) {
  this._params = params;
  this._init();
}
Connection.prototype = {
  _init: function() {
    this._callbacks = {};

    this._sender = fluent.createFluentSender('groonga',
                                             { host: this._params.host,
                                               port: this._params.port });
    this._server = http.createServer(this._handleHttpRequest.bind(this));
    this._socket = socketIo.listen(this._server);

    var self = this;
    this._socket.sockets.on('connection', function(socket) {
      socket.on('groonga.result', self._handleResult.bind(self));
    });
    this._socket.set('log level', 1);
  },

  _handleHttpRequest: function(request, response) {
  },

  _handleResult: function(data) {
    var id = data['query']['requestid']
    var callbck = this._callbacks[id];
    if (callback) {
      delete this._callbacks[id];
      callback(data['result']);
    } else {
      // something went wrong;
    }
  },

  _createId: function() {
    return Date.now() + ':' + Math.round(Math.random() * 65536);
  },

  search: function(query, callback) {
    var id = this._createId();
    var message = {
      requestid: id,
      command:   'search',
      query:     query
    };
    this._callbacks[id] = callback;
    this._sender.emit('query', message);
  }
}
export.Connection = Connection;
