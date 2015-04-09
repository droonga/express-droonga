/**
 * usage:
 *   var Agent = require('lib/serf/agent');
 *   var serf = new Agent({
 *                serf:         '/path/to/serf',
 *                hostName:     'node0',
 *                otherMembers: ['node0:7946', 'node1:8946', 'node2', ...]
 *              });
 *   serf.start()
 *     .then(function() { ... })
 *     .catch(function(error) { ... });
 *   serf.on('member-join', function(nodeName) { console.log(nodeName + ' joined'); });
 *   serf.on('member-leave', function(nodeName) { console.log(nodeName + ' leaved'); });
 *   serf.on('member-failed', function(nodeName) { console.log(nodeName + ' failed'); });
 *   serf.shutdown();
 */

var EventEmitter = require('events').EventEmitter,
    exec  = require('child_process').exec,
    fs    = require('fs'),
    path  = require('path'),
    Q     = require('q'),
    spawn = require('child_process').spawn,
    util  = require('util');

var ConsoleLogger = require('../console-logger').ConsoleLogger,
    Downloader    = require('./downloader');

var NODE_NAME_PATTERN = /^([^:]+):(\d+)\/(.+)$/;
var EVENT_LOG_PATTERN = /\[INFO\] serf: ([^:]+): ([^\s]+)(?: ([^\s]+))?/;
var DEFAULT_BIND_PORT = 7946;
var BIND_PORT         = 8946;
var RPC_PORT          = 8373;

function Agent(options) {
  options = options || {};

  this._logger = options.logger || new ConsoleLogger();

  this._hostName = options.hostName;
  this._nodeName = this._hostName + '/protocol-adapter';

  this.rpcAddress = this._hostName + ':' + RPC_PORT;

  this._serf = options.serf || 'serf';
  if (this._serf.charAt(0) == '.')
    this._serf = path.resolve(this._serf);

  this._otherMembers = options.otherMembers || options.otherMember || [];
  if (!Array.isArray(this._otherMembers))
    this._otherMembers = [this._otherMembers];

  this._agentProcess = null;
  this.shutdown = this.shutdown.bind(this);
}

util.inherits(Agent, EventEmitter);

Agent.prototype.start = function() {
  this._logger.trace('Starting Serf agent (' + this._serf + ')');
  return Q.Promise((function(resolve, reject, notify) {
    if (this._agentProcess)
      return resolve();

    if (this._serf.charAt(0) == '/' &&
        !fs.existsSync(this._serf)) {
      this._logger.info('Serf command is not found. Install Serf automatically.');
      new Downloader({ logger: this._logger })
        .saveTo(path.dirname(this._serf))
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
};

Agent.prototype.tryStart = function() {
  var agentArgs = [
    'agent',
    '-node', this._nodeName,
    '-bind', this._hostName + ':' + BIND_PORT,
    '-rpc-addr', this._hostName + ':' + RPC_PORT,
    '-log-level', 'INFO',
    '-tag', 'type=protocol-adapter'
  ];
  this._otherMembers.forEach(function(address) {
    if (address.indexOf(':') < 0)
      address = address + ':' + DEFAULT_BIND_PORT;
    agentArgs.push('-retry-join');
    agentArgs.push(address);
  });
  try {
    this._logger.info('Starting Serf agent: ' + this._serf + ' ' + agentArgs.join(' '));
    this._agentProcess = spawn(this._serf, agentArgs);
    this._agentProcess.on('close', (function(exitStatusCode) {
      if (exitStatusCode != 0)
        this._logger.error(new Error('Serf agent is closed with error: ' + exitStatusCode));
      this._agentProcess = null;
    }).bind(this));
    this._agentProcess.stdout.on('data', (function(data) {
      this._handleOutput(String(data));
    }).bind(this));
  } catch(error) {
    this._agentProcess = null;
    this._logger.error(error);
  }
};

Agent.prototype._handleOutput = function(output) {
  this._logger.trace('Serf agent output: ' + output);
  var matched = output.match(EVENT_LOG_PATTERN);
  if (!matched)
    return;

  var eventName = matched[1];
  var nodeName  = matched[2];
  if (nodeName == this._nodeName)
    return;

  var memberChanged = false;
  switch (eventName) {
    case 'EventMemberJoin':
      memberChanged = true;
      this.emit('member-join', nodeName);
      break;
    case 'EventMemberLeave':
      memberChanged = true;
      this.emit('member-leave', nodeName);
      break;
    case 'EventMemberFailed':
      memberChanged = true;
      this.emit('member-failed', nodeName);
      break;
    case 'EventMemberUpdate':
      memberChanged = true;
      this.emit('member-update', nodeName);
      break;
    case 'EventMemberReap':
      memberChanged = true;
      this.emit('member-reap', nodeName);
      break;
    default:
      break;
  }
  if (memberChanged)
    this.emit('member-change', nodeName);
};

Agent.prototype.shutdown = function() {
  this._logger.info('Shutting down Serf agent');
  return Q.Promise((function(resolve, reject, notify) {
    this.removeAllListeners();
    if (!this._agentProcess)
      return resolve();
    try {
      this._agentProcess.stdout.removeAllListeners();
      this._agentProcess.removeAllListeners();
      this._agentProcess.kill();
      this._agentProcess = null;
      resolve();
    } catch(error) {
      this._logger.error(error);
      reject(error);
    }
  }).bind(this));
};

module.exports = Agent;
