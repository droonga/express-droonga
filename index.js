var express = require('express');
var Connection = require('./lib/backend/connection').Connection;
var restAdaptor = require('./lib/frontend/rest-adaptor');
var socketIoAdaptor = require('./lib/frontend/socket.io-adaptor');
var dashboardHandler = require('./lib/frontend/dashboard-handler');

express.application.droonga = function(params) {
  params = params || {};

  params.connection = params.connection || new Connection(params);
  var connection = params.connection;

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  restAdaptor.register(this, params);

  if (params.server) {
    socketIoAdaptor.register(this, params.server, params);
    params.server.on('close', function() {
      // The connection can be mocked/stubbed. We don't need to close
      // such a fake connection.
      if (typeof connection.close == 'function')
        connection.close();
    });
  }

  dashboardHandler.register(this, params);

  this.connection = connection;
  this.emitMessage = connection.emitMessage.bind(connection); // shorthand
}

exports.model = require('./lib/model');
