#!/usr/bin/env node

var express = require('express'),
    droonga = require('./index'),
    http = require('http');

var application = express();
var server = http.createServer(application);
application.droonga({
  prefix: '',
  defaultDataset: 'example',
  server: server,
  plugins: [
    droonga.API_REST,
    droonga.API_SOCKET_IO,
    droonga.API_GROONGA,
    droonga.API_DROONGA
  ]
});

server.listen(13000);
