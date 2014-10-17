var express = require('express');
var Connections = require('./lib/droonga-protocol/connections').Connections;
var httpAdapter = require('./lib/adapter/http');
var socketIoAdapter = require('./lib/adapter/socket.io');
var dashboardUI = require('./lib/ui/dashboard');
var ConsoleLogger = require('./lib/console-logger').ConsoleLogger;

function droonga(application, params) {
  params = params || {};

  params.logger = params.logger || new ConsoleLogger();

  params.connections = params.connections || new Connections(params);
  var connections = params.connections;

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  httpAdapter.register(application, params);

  if (params.server) {
    socketIoAdapter.register(application, params.server, params);
    params.server.on('error', function(error) {
      connections.closeAll();
    });
    params.server.on('close', function() {
      // The connection can be mocked/stubbed. We don't need to close
      // such a fake connection.
      if (typeof connections.closeAll == 'function')
        connections.closeAll();
    });
  }

  dashboardUI.register(application, params);

  application.connections = connections;
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
