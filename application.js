#!/usr/bin/env node

var express = require('express'),
    droonga = require('./index'),
    http = require('http');

var builtInRestAPI = require('./lib/adapter/api/rest');
var builtInSocketIoAPI = require('./lib/adapter/api/socket.io');
var builtInGroongaAPI = require('./lib/adapter/api/groonga');
var builtInDroongaAPI = require('./lib/adapter/api/droonga');

var application = express();
var server = http.createServer(application);
application.droonga({
  prefix: '',
  defaultDataset: 'example',
  server: server,
  plugins: [
    builtInRestAPI,
    builtInSocketIoAPI,
    builtInGroongaAPI,
    builtInDroongaAPI
  ]
});

server.listen(13000);
