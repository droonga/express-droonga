var express = require('express');
var ConnectionPool = require('./lib/droonga-protocol/connection-pool').ConnectionPool;
var httpAdapter = require('./lib/adapter/http');
var socketIoAdapter = require('./lib/adapter/socket.io');
var dashboardUI = require('./lib/ui/dashboard');
var ConsoleLogger = require('./lib/console-logger').ConsoleLogger;

function droonga(application, params) {
  params = params || {};

  params.logger = params.logger || new ConsoleLogger();

  params.connectionPool = params.connectionPool || new ConnectionPool(params);
  var connectionPool = params.connectionPool;

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  httpAdapter.register(application, params);

  if (params.server) {
    socketIoAdapter.register(application, params.server, params);
    params.server.on('error', function(error) {
      connectionPool.closeAll();
    });
    params.server.on('close', function() {
      // The connection can be mocked/stubbed. We don't need to close
      // such a fake connection.
      if (typeof connectionPool.closeAll == 'function')
        connectionPool.closeAll();
    });
  }

  dashboardUI.register(application, params);

  application.connectionPool = connectionPool;
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
