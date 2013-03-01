#!/usr/bin/env node

var express = require('express'),
    droonga = require('./index'),
    http = require('http');

var application = express();
var server = http.createServer(application);
application.droonga({
  prefix: '/droonga',
  server: server
});

server.listen(13000);
