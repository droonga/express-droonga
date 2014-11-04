/**
 * var connectionPool = new ConnectionPool({
 *                            tag:             'droonga',
 *                            defaultDataset:  'example',
 *                            hostNames:       ['127.0.0.1', ...],
 *                            port:            24224,
 *                            receiveHostName: '127.0.0.1',
 *                            receivePort:     10030
 *                          });
 */

var exec = require('child_process').exec,
    path = require('path'),
    Q    = require('q');

var Connection = require('./connection').Connection;
var ConsoleLogger = require('../console-logger').ConsoleLogger;
var Catalog = require('../catalog').Catalog;

function ConnectionPool(params) {
  this._params = params || {};

  if (!this._params.logger)
    this._params.logger = new ConsoleLogger();

  this._hostNames = [];
  this._connections = {};

  this.hostNames = this._params.hostNames ||
                    this._params.hostName ||
                    Connection.DEFAULT_FLUENT_HOST_NAME;
}

ConnectionPool.prototype = {
  get hostNames() {
    return this._hostNames;
  },
  set hostNames(hostNames) {
    if (!Array.isArray(hostNames))
      hostNames = [hostNames];

    var uniqueHostNames = {};
    hostNames.forEach(function(hostName) {
      if (hostName in uniqueHostNames) {
        return false;
      }
      else {
        uniqueHostNames[hostName] = true;
        return true;
      }
    });
    var newHostNames = Object.keys(uniqueHostNames);

    this._hostNames.forEach(function(hostName) {
      if (newHostNames.indexOf(hostName) > -1)
        return;

      this.closeFor(hostName);
    }, this);

    this._hostNames = newHostNames;
    this.nextIndex = Math.floor(Math.random() * this._hostNames.length);

    if (this._hostNames.length == 0)
      throw new Error('ConnectionPool: you must give one or more host name(s)!');

    return this._hostNames;
  },

  get: function() {
    var hostName = this.hostNames[this.nextIndex];

    this.nextIndex++;
    if (this.nextIndex == this.hostNames.length)
      this.nextIndex = 0;

    return this.getConnectionFor(hostName);
  },

  getConnectionFor: function(hostName) {
    if (this._connections[hostName])
      return this._connections[hostName];;

    var klass = this._params.connectionClass || Connection;
    return this._connections[hostName] = new klass({
      tag:             this._params.tag,
      defaultDataset:  this._params.defaultDataset,
      hostName:        hostName,
      port:            this._params.port,
      receiveHostName: this._params.receiveHostName,
      receivePort:     this._params.receivePort,
      logger:          this._params.logger
    });
  },

  closeAll: function() {
    this._hostNames.forEach(this.closeFor, this);
  },

  closeFor: function(hostName) {
    var connection = this._connections[hostName];
    if (!connection)
      return;
    connection.close();
    delete this._connections[hostName];
  },

  get count() {
    return this._hostNames.length;
  },

  updateHostNamesFromCatalog: function() {
    return this.getHostNamesFromCatalog()
                 .then((function(hostNames) {
                   this.hostNames = hostNames;
                   return hostNames;
                 }).bind(this));
  },

  getHostNamesFromCatalog: function() {
    return this.fetchCatalog()
                 .then(function(catalog) {
                   return catalog.allHostNames;
                 });
  },

  fetchCatalog: function() {
    return this.get().thenableEmitMessage('catalog.fetch')
                       .then(this._handleFetchedCatalog.bind(this));
  },
  _handleFetchedCatalog: function(result) {
    this._params.logger.debug('ConnectionPool: fetchCatalog: fetched result');
    this._params.logger.debug(result);
    if (result.errorCode) {
      this._params.logger.error(new Error('ConnectionPool: failed to fetch catalog'));
      return;
    }
    var catalog = result.response.body;
    return new Catalog(catalog);
  },

  getHostNamesFromCluster: function() {
    return Q.Promise((function(resolve, reject, notify) {
      // Because node-rpc has no API to disconnect from the RPC host,
      // we should use it in a separate expendable process.
      var commandPath = path.join(__dirname, '..', '..', 'bin',
                          'express-droonga-report-live-engine-hosts');
      var commandLine = [
        commandPath,
          '--droonga-engine-host-name=' + this._hostNames[0],
          '--droonga-engine-port=' + this._params.port,
          '--tag=' + this._params.tag
      ].join(' ');
      exec(commandLine, function(error, stdin, stdout) {
        if (error)
          return reject(error);
        resolve(stdin.trim().split('\n'));
      });
    }).bind(this));
  },

  updateHostNamesFromCluster: function() {
    return this.getHostNamesFromCluster()
                 .then((function(hostNames) {
                   this.hostNames = hostNames;
                   return hostNames;
                 }).bind(this));
  }
};

exports.ConnectionPool = ConnectionPool;
