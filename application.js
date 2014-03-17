#!/usr/bin/env node

var express = require('express'),
    droonga = require('./index'),
    http = require('http'),
    options = require('commander');

var version = require('./package.json').version;

options
  .version(version)
  .option('--port <port>', 'Port number', parseInt, 13000)
  .option('--droonga-engine-port <port>', 'Port number of Droonga engine',
          parseInt, 24224)
  .option('--enable-logging', 'Enable logging to the standard output')
  .parse(process.argv);

var application = express();
var server = http.createServer(application);

var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();
application.configure(function() {
  if (options.enableLogging) {
    application.use(express.logger());
  }
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
  port: options.droongaEnginePort,
  plugins: [
    droonga.API_REST,
    droonga.API_SOCKET_IO,
    droonga.API_GROONGA,
    droonga.API_DROONGA
  ]
});

server.listen(options.port);
