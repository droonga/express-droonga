/**
 * usage:
 *   var Client = require('lib/serf/client');
 *   var serf = new Client({
 *                rpcAddress: 'node0:7373', // endpoint of Serf RPC
 *                tag:        'droonga', // tag of engines, can be omitted
 *                enginePort: 10031 // port number of engines, can be omitted
 *              });
 *   serf.getAllMembers()
 *         .then(function(members) { console.log(members); })
 *         // members:
 *         //   [{ Name:     'node0:10031/droonga',
 *         //      Port:     7946,
 *         //      Status:   'alive', ... }, ...]
 *         .catch(function(e) { console.error(e); });
 *   serf.getLiveEngineNodes()
 *         .then(function(members) { console.log(members); })
 *         // members:
 *         //   [{ Name:     'node0:10031/droonga',
 *         //      Port:     7946,
 *         //      Status:   'alive',
 *         //      HostName: 'node0', ... }, ...]
 *         .catch(function(e) { console.error(e); });
 */

var SerfRPC = require('serf-rpc'),
    Q       = require('q');

var ENGINE_NODE_NAME_PATTERN = /^([^:]+):(\d+)\/(.+)$/;
var DEFAULT_RPC_PORT = 7373;

function Client(options) {
  options = options || {};
  options.rpcAddress = options.rpcAddress || '127.0.0.1';

  this._droongaEngineHost = options.rpcAddress.split(':')[0];
  this._droongaEnginePort = options.enginePort || 10031;
  this._droongaTag        = options.tag || 'droonga';

  this._connectionOptions = {
    rpc_host: this._droongaEngineHost,
    rpc_port: parseInt(options.rpcAddress.split(':')[1] || DEFAULT_RPC_PORT)
  };
  this._client = new SerfRPC();
  this._connected = false;
}
Client.prototype = {
  connect: function() {
    return Q.Promise((function(resolve, reject, notify) {
      if (this._connected)
        return resolve();

      this._client.connect(this._connectionOptions, (function(error) {
        if (error)
          return reject(error);
        this._connected = true;
        resolve();
      }).bind(this));
    }).bind(this));
  },

  getAllMembers: function() {
    return this.connect().then((function() {
      return Q.Promise((function(resolve, reject, notify) {
        this._client.members(function(error, result) {
          if (error)
            return reject(error);
          resolve(result.Members);
        });
      }).bind(this));
    }).bind(this));
  },

  getLiveEngineNodes: function() {
    return this.getAllMembers().then((function(members) {
      var clusterId;
      var liveEngineNodes = members.filter(function(member) {
        if (member.Tags.role != 'engine')
          return false;

        var matched = String(member.Name).match(ENGINE_NODE_NAME_PATTERN);
        if (matched)
          member.HostName = matched[1];

        if (member.HostName == this._droongaEngineHost ||
            member.Addr.join('.') == this._droongaEngineHost)
          clusterId = member.Tags.cluster_id;

        return matched &&
                 matched[2] == this._droongaEnginePort &&
                 matched[3] == this._droongaTag &&
                 member.Status == 'alive';
      }, this);
      if (clusterId)
        liveEngineNodes = liveEngineNodes.filter(function(member) {
          return member.Tags.cluster_id == clusterId;
        });
      return liveEngineNodes;
    }).bind(this));
  },

  joinToCluster: function(parameters) {
    var hosts = parameters.hosts;
    return this.connect().then((function() {
      return Q.Promise((function tryJoin(resolve, reject, notify) {
        var host = hosts.shift();
        this._client.join(host, function(error, result) {
          if (error) {
            if (hosts.length == 0)
              return reject(error);
            else
              tryJoin.call(this, resolve, reject, notify);
          }
          resolve(result.Existing);
        });
      }).bind(this));
    }).bind(this));
  },
};

module.exports = Client;
