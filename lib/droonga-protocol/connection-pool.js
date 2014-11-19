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
var SerfAgent = require('../serf/agent');

function ConnectionPool(params) {
  this._params = params || {};

  this._logger = this._params.logger || new ConsoleLogger();

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
      logger:          this._logger
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

  getHostNamesFromCluster: function(retryCount) {
    if (this._watching)
      return this.getHostNamesFromClusterMember(this._serf.rpcAddress);

    retryCount = retryCount || 0;
    var hostName = this._hostNames[retryCount];
    if (!hostName)
      return Q.Promise((function(resolve, reject, notify) {
        var error = new Error('all cluster members are unaccessible.');
        this._logger.error(error);
        reject(error);
      }).bind(this));

    return this.getHostNamesFromClusterMember(hostName)
                 .then(function(hostNames) {
                   return hostNames;
                 })
                 .catch((function(error) {
                   this._logger.error('Failed to get the list of droonga-engine hosts from the cluster member ' + hostName + '.');
                   this._logger.error(error);
                   return this.getHostNamesFromCluster(retryCount + 1);
                 }).bind(this));
  },
  getHostNamesFromClusterMember: function(rpcAddress) {
    return Q.Promise((function(resolve, reject, notify) {
      if (!rpcAddress)
        reject(new Error('no RPC address is given'));

      // Because node-rpc has no API to disconnect from the RPC host,
      // we should use it in a separate expendable process.
      var commandPath = path.join(__dirname, '..', '..', 'bin',
                          'express-droonga-report-live-engine-hosts');
      var commandLine = [
        commandPath,
          '--rpc-address=' + rpcAddress,
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
                   this._logger.info('List of droonga-engine hosts is successfully initialized from the cluster.');
                   this._logger.info(hostNames);
                   return hostNames;
                 }).bind(this))
                 .catch(function(error) {
                   this._logger.error('Failed to initialize the list of droonga-engine hosts from the cluster.');
                   this._logger.error(error);
                 });
  },

  startWatchClusterChanges: function() {
    return Q.Promise((function(resolve, reject, notify) {
    if (this._watching)
      return resolve();
    this._serf = new SerfAgent({
      serf:         this._params.serf,
      hostName:     this._params.receiveHostName,
      otherMembers: this.hostNames,
      logger:       this._logger
    });
    this._serf.start()
      .then((function() {
        this._logger.info('Start to watch changes in the cluster.');
        this._watching = true;
    this._serf.on('member-change', (function() {
      if (this._updateHostNamesTimer)
        return;
      this._updateHostNamesTimer = setTimeout((function() {
        this._updateHostNamesTimer = null;
        this.updateHostNamesFromCluster()
              .then(this.endWatchClusterChanges.bind(this))
              .then(this.startWatchClusterChanges.bind(this));
      }).bind(this), 500);
    }).bind(this));
        resolve();
      }).bind(this))
      .catch(function(error) {
        this._logger.error('Failed to start watching of changes in the cluster.');
        this._logger.error(error);
        reject(error);
      });
    }).bind(this));
  },

  endWatchClusterChanges: function() {
    return Q.Promise((function(resolve, reject, notify) {
    if (!this._watching)
      return resolve();
    this._serf.shutdown()
                .then((function() {
                  delete this._serf;
                  this._watching = false;
                  resolve();
                }).bind(this));
    }).bind(this));
  },


  startSyncHostNamesFromCluster: function() {
    return this.updateHostNamesFromCluster()
                 .then(this.startWatchClusterChanges.bind(this));
  },

  stopSyncHostNamesFromCluster: function() {
    return this.endWatchClusterChanges();
  }
};

exports.ConnectionPool = ConnectionPool;
