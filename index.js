var http = require('http');
var express = require('express');
var restAdaptor = require('./lib/rest-adaptor');
var socketAdaptor = require('./lib/socket-adaptor');

express.application.kotoumi = function(params) {
  params = params || {};

  params.connection = params.connection || new Connection(params);

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  restAdaptor.registerHandlers(this, params);

  params.server = params.server || http.createServer(this);
  socketAdaptor.registerHandlers(this, params.server, params);

  return params.server;
}
