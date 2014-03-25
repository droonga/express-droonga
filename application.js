#!/usr/bin/env node

var express = require('express'),
    droonga = require('./index'),
    cache = require('./lib/response-cache'),
    responseTime = require('response-time'),
    http = require('http'),
    options = require('commander');

var version = require('./package.json').version;

options
  .version(version)
  .option('--port <port>', 'Port number', parseInt, 13000)
  .option('--droonga-engine-host-name <name>', 'Host name of Droonga engine',
          '127.0.0.1')
  .option('--droonga-engine-port <port>', 'Port number of Droonga engine',
          parseInt, 24224)
  .option('--default-dataset <dataset>', 'The default dataset',
          'Droonga')
  .option('--enable-logging', 'Enable logging to the standard output')
  .option('--cache-size <size>', 'The max number of cached requests',
          parseInt, 100)
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
  application.use(responseTime());
  if (options.cacheSize > 0) {
    application.use(cache({
      size: options.cacheSize,
      rules: [
        { regex: /./ }
      ]
    }));
  }
});

application.droonga({
  prefix: '',
  defaultDataset: options.defaultDataset,
  server: server,
  sessionStore: sessionStore, // this is required to share session information by socket.io and HTTP APIs
  hostName: options.droongaEngineHostName,
  port: options.droongaEnginePort,
  plugins: [
    droonga.API_REST,
    droonga.API_SOCKET_IO,
    droonga.API_GROONGA,
    droonga.API_DROONGA
  ]
});

server.listen(options.port);
