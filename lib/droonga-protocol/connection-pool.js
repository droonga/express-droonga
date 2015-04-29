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

var LOG_PREFIX = '[connection-pool] ';

function ConnectionPool(params) {
  this._params = params || {};

  this._logger = this._params.logger || new ConsoleLogger();

  this._hostNames = [];
  this._connections = {};

  this.hostNames = this._params.hostNames ||
                    this._params.hostName ||
                    Connection.DEFAULT_FLUENT_HOST_NAME;

  this._initialHostNames = this._hostNames.slice(0);
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
    // When the cluster members are changing, we cannot get
    // actual connection for a member.
    if (this.updating)
      return null;

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
      defaultTimeout:  this._params.defaultTimeout,
      hostName:        hostName,
      port:            this._params.port,
      receiveHostName: this._params.receiveHostName,
      receivePort:     this._params.receivePort,
      logger:          this._logger
    });
  },

  getStatus: function() {
    var connections = {};
    Object.keys(this._connections).forEach(function(hostName) {
      var connection = this._connections[hostName];
      connections[hostName] = connection.getStatus();
    }, this);
    return connections;
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

  getEnginesFromCluster: function(retryCount) {
    this._logger.info(LOG_PREFIX + 'Getting engine names from cluster.');
    if (this._watching)
      return this.getEnginesFromClusterMember(this._serf.rpcAddress);

    this._logger.info(LOG_PREFIX + 'Not watching: getting engine names from predetected member.');
    retryCount = retryCount || 0;
    var hostName = this._hostNames[retryCount];
    if (!hostName) {
      var error = new Error('all cluster members are unaccessible.');
      this._logger.error(LOG_PREFIX, error);
      return Q.Promise.reject(error);
    }

    return this.getEnginesFromClusterMember(hostName)
                 .then(function(engines) {
                   return engines;
                 })
                 .catch((function(error) {
                   this._logger.error(LOG_PREFIX + 'Failed to get the list of droonga-engine hosts ' +
                                        'from the cluster member ' + hostName + '. Retrying...',
                                      error);
                   return this.getEnginesFromCluster(retryCount + 1);
                 }).bind(this));
  },
  getEnginesFromClusterMember: function(rpcAddress) {
    this._logger.info(LOG_PREFIX + 'Getting engine names from a cluster member ' + rpcAddress + '.');
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
          '--tag=' + this._params.tag,
          '--priority-hosts=' + this._initialHostNames.join(',')
      ].join(' ');
      exec(commandLine, (function(error, stdin, stdout) {
        if (error) {
          this._logger.error(LOG_PREFIX + 'express-droonga-report-live-engine-hosts:',
                             stdin.trim());
          return reject(error);
        }
        var result = JSON.parse(stdin.trim());
        this._logger.trace(LOG_PREFIX + 'express-droonga-report-live-engine-hosts:',
                           result);
        resolve(result.liveEngineNodes);
      }).bind(this));
    }).bind(this));
  },
  reJoinToInitialCluster: function() {
    return Q.Promise((function(resolve, reject, notify) {
      // Because node-rpc has no API to disconnect from the RPC host,
      // we should use it in a separate expendable process.
      var commandPath = path.join(__dirname, '..', '..', 'bin',
                          'express-droonga-join-to-cluster');
      var commandLine = [
        commandPath,
          '--rpc-address=' + this._serf.rpcAddress,
          '--droonga-engine-port=' + this._params.port,
          '--tag=' + this._params.tag,
          '--hosts=' + this._initialHostNames.join(',')
      ].join(' ');
      exec(commandLine, (function(error, stdin, stdout) {
        if (error) {
          this._logger.error(LOG_PREFIX + 'express-droonga-join-to-cluster:',
                             stdin.trim());
          return reject(error);
        }
        resolve();
      }).bind(this));
    }).bind(this));
  },

  updateHostNamesFromCluster: function() {
    if (this.updating)
      return Q.Promise.resolve();

    this._logger.info(LOG_PREFIX + 'Starting to update host names.');
    this.updating = true;
    return this.getEnginesFromCluster()
                 .then((function(engines) {
                   this.clusterId = engines[0].Tags.cluster_id;
                   var hostNames = engines.map(function(engine) {
                     return engine.HostName;
                   });
                   // Close all existing connections to droonga-engine nodes.
                   // Otherwise, old droonga-engine processes become zombie.
                   this.closeAll();
                   this.hostNames = hostNames;
                   this._logger.info(LOG_PREFIX + 'List of droonga-engine hosts is successfully initialized from the cluster.');
                   this._logger.info(LOG_PREFIX + 'cluster id: '+this.clusterId);
                   this._logger.info(LOG_PREFIX + JSON.stringify(hostNames));
                   this.updating = false;
                   return hostNames;
                 }).bind(this))
                 .catch(function(error) {
                   this._logger.error(LOG_PREFIX + 'Failed to initialize the list of droonga-engine hosts from the cluster.',
                                      error);
                   this.updating = false;
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
          this._logger.info(LOG_PREFIX + 'Start to watch changes in the cluster.');
          this._watching = true;
          this._serf.on('member-change', (function() {
            this._logger.info(LOG_PREFIX + 'Serf cluster member is changed.');
            if (this._updateHostNamesTimer)
              return;
            this._updateHostNamesTimer = setTimeout((function() {
              this._updateHostNamesTimer = null;
              this.updateHostNamesFromCluster()
                .then((function() {
                  if (this._hostNames.length == 0) {
                    return this.reJoinToInitialCluster();
                  }
                }).bind(this));
            }).bind(this), 500);
          }).bind(this));
          resolve();
        }).bind(this))
        .catch(function(error) {
          this._logger.error(LOG_PREFIX + 'Failed to start watching of changes in the cluster.',
                             error);
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
    this._defaultHostNames = this._hostNames.slice(0);
    return this.updateHostNamesFromCluster()
                 .then(this.startWatchClusterChanges.bind(this));
  },

  stopSyncHostNamesFromCluster: function() {
    return this.endWatchClusterChanges();
  },

  shutdown: function() {
    this._logger.info(LOG_PREFIX + 'closing all connections...');
    this.closeAll();
    this._logger.info(LOG_PREFIX + 'done.');

    this._logger.info(LOG_PREFIX + 'stopping serf agent...');
    this.stopSyncHostNamesFromCluster();
    this._logger.info(LOG_PREFIX + 'done.');
  }
};

exports.ConnectionPool = ConnectionPool;
