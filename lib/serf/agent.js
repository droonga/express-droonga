/**
 * usage:
 *   var Agent = require('lib/serf/agent');
 *   var serf = new Agent({
 *                serf: '/path/to/serf',
 *                name: 'node0:10041/droonga',
 *                otherHostNames: ['node0:7946', 'node1:8946', 'node2', ...]
 *              });
 *   serf.start()
 *     .then(function() { ... })
 *     .catch(function(error) { ... });
 *   serf.shutdown();
 */

var exec  = require('child_process').exec,
    fs    = require('fs'),
    path  = require('path'),
    Q     = require('q'),
    spawn = require('child_process').spawn;

var ConsoleLogger = require('../console-logger').ConsoleLogger,
    Downloader    = require('./downloader');

var NODE_NAME_PATTERN = /^([^:]+):(\d+)\/(.+)$/;

function Agent(options) {
  options = options || {};

  this._logger = options.logger || new ConsoleLogger();

  this._name = options.name;
  this._serf = options.serf || 'serf';
  if (this._serf.charAt(0) == '.')
    this._serf = path.resolve(this._serf);

  this._otherHostNames = options.otherHostNames || options.otherHostName || [];
  if (!Array.isArray(this._otherHostNames))
    this._otherHostNames = [this._otherHostNames];

  var matched = String(this._name).match(NODE_NAME_PATTERN);
  if (!matched)
    throw new Error('Name must be <host name>:<port number>/<tag name> !');

  this._hostName = matched[1];
  this._port     = matched[2];
  this._tag      = matched[3];

  this._agentProcess = null;
  this.shutdown = this.shutdown.bind(this);
}
Agent.prototype = {
  start: function() {
    this._logger.debug('Starting Serf agent (' + this._serf + ')');
    return Q.Promise((function(resolve, reject, notify) {
      if (this._agentProcess)
        return resolve();

      if (this._serf.charAt(0) == '/' &&
          !fs.existsSync(this._serf)) {
        this._logger.info('Serf command is not found. Install Serf automatically.');
        new Downloader().saveTo(path.dirname(this._serf))
          .then((function() {
            this.start().then(resolve).catch(reject);
          }).bind(this))
          .catch(reject);
        return;
      }

      exec(this._serf + ' version', (function(error, stdin, stdout) {
        if (error)
          return reject(new Error('Serf is not available.'));
        try {
          this.tryStart();
          resolve();
        } catch(error) {
          reject(error);
        }
      }).bind(this));
    }).bind(this));
  },

  tryStart: function() {
    var eventHandlerPath = path.join(__dirname, '..', '..', 'bin',
                                       'express-droonga-serf-event-handler');
    var agentArgs = [
      'agent',
      '-node', this._name,
      '-bind', this._hostName + ':8946',
      // '-event-handler', eventHandlerPath,
      // '-log-level', this._logLevel,
      '-tag', 'role=protocol-adapter'
    ];
    this._otherHostNames.forEach(function(hostName) {
      agentArgs.push('-retry-join');
      if (!/^[^:]+:\d+$/.test(hostName))
        hostName = hostName + ':7946';
      agentArgs.push(hostName);
    });
    try {
      this._logger.info('Starting Serf agent: ' + this._serf + ' ' + agentArgs.join(' '));
      this._agentProcess = spawn(this._serf, agentArgs);
      this._agentProcess.on('close', (function(exitStatusCode) {
        if (exitStatusCode != 0)
          this._logger.error(new Error('Serf agent is closed with error: ' + exitStatusCode));
        this._agentProcess = null;
      }).bind(this));
    } catch(error) {
      this._agentProcess = null;
      this._logger.error(error);
    }
  },

  shutdown: function() {
    this._logger.info('Shutting down Serf agent');
    if (!this._agentProcess)
      return;
    try {
      this._agentProcess.removeAllListeners();
      this._agentProcess.kill();
      this._agentProcess = null;
    } catch(error) {
      this._logger.error(error);
    }
  }
};

module.exports = Agent;
