var express = require('express');
var Connection = require('./lib/backend/connection').Connection;
var restHandler = require('./lib/frontend/rest-handler');
var socketIoHandler = require('./lib/frontend/socket.io-handler');
var dashboardHandler = require('./lib/frontend/dashboard-handler');

express.application.kotoumi = function(params) {
  params = params || {};

  params.connection = params.connection || new Connection(params);

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  restHandler.register(this, params);

  if (params.server)
    socketIoHandler.register(this, params.server, params);

  dashboardHandler.register(this, params);
}
