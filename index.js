var express = require('express');
var ConnectionPool = require('./lib/droonga-protocol/connection-pool').ConnectionPool;
var httpAdapter = require('./lib/adapter/http');
var socketIoAdapter = require('./lib/adapter/socket.io');
var dashboardUI = require('./lib/ui/dashboard');
var ConsoleLogger = require('./lib/console-logger').ConsoleLogger;

var LOG_PREFIX = '[global] ';

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
      params.logger.error(LOG_PREFIX + 'Unhandled Error', error);
      if (typeof connectionPool.shutdown == 'function')
        connectionPool.shutdown();
    });
    params.server.on('close', function() {
      if (typeof connectionPool.shutdown == 'function')
        connectionPool.shutdown();
    });
  }

  dashboardUI.register(application, params);

  application.connectionPool = connectionPool;

  if (params.syncHostNames &&
      typeof connectionPool.startSyncHostNamesFromCluster == 'function') {
    params.server.on('listening', function() {
      connectionPool.startSyncHostNamesFromCluster();
    });
  }

  application.get(params.prefix + '/engines', function(request, response, next) {
    response.jsonp({
      clusterId: connectionPool.clusterId,
      hostNames: connectionPool.hostNames
    });
  });

  application.get(params.prefix + '/connections', function(request, response, next) {
    response.jsonp(connectionPool.getStatus());
  });
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
