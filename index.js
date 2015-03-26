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
      if (typeof connectionPool.closeAll == 'function')
        connectionPool.closeAll();
      if (typeof connectionPool.stopSyncHostNamesFromCluster == 'function')
        connectionPool.stopSyncHostNamesFromCluster();
    });
    params.server.on('close', function() {
      if (typeof connectionPool.closeAll == 'function')
        connectionPool.closeAll();
      if (typeof connectionPool.stopSyncHostNamesFromCluster == 'function')
        connectionPool.stopSyncHostNamesFromCluster();
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
