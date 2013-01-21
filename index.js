var express = require('express');
var Connection = require('./lib/backend-adaptor').Connection;
var restAdaptor = require('./lib/rest-adaptor');
var socketAdaptor = require('./lib/socket-adaptor');

express.application.kotoumi = function(params) {
  params = params || {};

  params.connection = params.connection || new Connection(params);

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  restAdaptor.registerHandlers(this, params);

  if (params.server)
    socketAdaptor.registerHandlers(this, params.server, params);
}
