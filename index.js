var express = require('express');
var Connection = require('./lib/droonga-protocol/connection').Connection;
var httpAdapter = require('./lib/adapter/http');
var socketIoAdapter = require('./lib/adapter/socket.io');
var dashboardUI = require('./lib/ui/dashboard');

function droonga(application, params) {
  params = params || {};

  params.connection = params.connection || new Connection(params);
  var connection = params.connection;

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  httpAdapter.register(application, params);

  if (params.server) {
    socketIoAdapter.register(application, params.server, params);
    params.server.on('close', function() {
      // The connection can be mocked/stubbed. We don't need to close
      // such a fake connection.
      if (typeof connection.close == 'function')
        connection.close();
    });
  }

  dashboardUI.register(application, params);

  application.connection = connection;
  application.emitMessage = connection.emitMessage.bind(connection); // shorthand
}

exports.initialize = droonga;
express.application.droonga = function(params) {
  droonga(this, params);
};

require('./lib/adapter/api').exportTo(exports);

exports.command = require('./lib/adapter/command');
exports.Cache = require('./lib/cache');
exports.middleware = {
  cacheStatistics: require('./lib/middleware/cache-statistics'),
  cache: require('./lib/middleware/cache')
};
