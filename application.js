#!/usr/bin/env node

var express = require('express'),
    droonga = require('./index'),
    http = require('http');

var application = express();
var server = http.createServer(application);

var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();
application.configure(function() {
  application.use(express.cookieParser('secret key'));
  application.use(express.session({
    secret: 'secret key',
    store:  sessionStore
  }));
});

application.droonga({
  prefix: '',
  defaultDataset: 'Droonga',
  server: server,
  sessionStore: sessionStore, // this is required to share session information by socket.io and HTTP APIs
  plugins: [
    droonga.API_REST,
    droonga.API_SOCKET_IO,
    droonga.API_GROONGA,
    droonga.API_DROONGA
  ]
});

server.listen(13000);
