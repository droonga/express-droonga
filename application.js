#!/usr/bin/env node

var express = require('express'),
    kotoumi = require('./index'),
    http = require('http');

var application = express();
var server = http.createServer(application);
application.kotoumi({
  prefix: '',
  server: server
});

serer.listen(13000);
