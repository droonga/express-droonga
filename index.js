var express = require('express');
var Connection = require('./lib/backend/connection').Connection;
var restAPI = require('./lib/frontend/api/rest');
var groongaAPI = require('./lib/frontend/api/groonga');
var socketIoAPI = require('./lib/frontend/api/socket.io');
var dashboardUI = require('./lib/frontend/ui/dashboard');

express.application.droonga = function(params) {
  params = params || {};

  params.connection = params.connection || new Connection(params);
  var connection = params.connection;

  params.prefix = params.prefix || '';
  params.prefix = params.prefix.replace(/\/$/, '');

  restAPI.register(this, params);
  groongaAPI.register(this, params);

  if (params.server) {
    socketIoAPI.register(this, params.server, params);
    params.server.on('close', function() {
      // The connection can be mocked/stubbed. We don't need to close
      // such a fake connection.
      if (typeof connection.close == 'function')
        connection.close();
    });
  }

  dashboardUI.register(this, params);

  this.connection = connection;
  this.emitMessage = connection.emitMessage.bind(connection); // shorthand
}

exports.model = require('./lib/model');
