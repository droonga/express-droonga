/**
 * usage:
 *   var Downloader = require('lib/serf/downloader');
 *   new Downloader().saveTo('/path/to/directory')
 *         .then(function() { console.log('success'); })
 *         .catch(function(e) { console.error(e); });
 */

var Download = require('download'),
    fs       = require('fs'),
    os       = require('os'),
    Q        = require('q');

var ConsoleLogger = require('../console-logger').ConsoleLogger;

var MAX_RETRY_COUNT = 5;
var RETRY_INTERVAL  = 10 * 1000;

var VERSION  = '0.6.3';
var BASE_URL = 'https://dl.bintray.com/mitchellh/serf';

function Downloader(options) {
  options = options || {};
  this._logger = options.logger || new ConsoleLogger();
}

Downloader.prototype = {
  saveTo: function(dir) {
    return Q.Promise((function(resolve, reject, notify) {
      if (!fs.existsSync(dir)) {
        var error = new Error(dir + ' does not exist!');
        this._logger.error(error);
        return reject(error);
      }

      try {
        var url = this.url;
        var retryCount = MAX_RETRY_COUNT;
        this._trySave(url, dir, retryCount)
          .then(resolve)
          .catch(reject);
      } catch(error) {
        this._logger.error(error);
        reject(error);
      }
    }).bind(this));
  },

  _trySave: function(url, dir, retryCount) {
    this._logger.debug('Serf Downloader: Trying to download ' + url +
                         ' to ' + dir + ' (rest=' + retryCount + ')');
    return Q.Promise((function(resolve, reject, notify) {
      try {
        var url = this.url;
        var download = new Download({ extract: true,
                                      mode:    '755' })
                             .get(url)
                             .dest(dir);
        download.run((function(error, files, stream) {
          if (error) {
            if (retryCount > 0) {
              this._logger.error(error);
              setTimeout((function() {
                this._logger.error('Serf Downloader: Retrying to download.');
                this._trySave(url, dir, retryCount - 1)
                       .then(resolve)
                       .catch(reject);
              }).bind(this), RETRY_INTERVAL);
              return;
            }
            return reject(error);
          }

          resolve(files);
        }).bind(this));
      } catch(error) {
        reject(error);
      }
    }).bind(this));
  },

  get url() {
    return BASE_URL + '/' +
             VERSION + '_' + this.os +'_' + this.architecture + '.zip';
  },

  get os() {
    switch (os.platform()) {
      case 'linux':
        return 'linux';
      case 'freebsd': // Not tested. Actually available?
        return 'freebsd';
      case 'darwin':
        return 'darwin';
      case 'win32':
        return 'windows';
      default:
        throw new Error('Unsupported OS: ' + os.platform());
    }
  },

  get architecture() {
    switch (os.arch()) {
      case 'x64':
      case 'x86_64': // Not tested. Actually available?
        return 'amd64';
      case 'i386': // Not tested. Actually available?
      case 'i686': // Not tested. Actually available?
        return '386';
      default:
        throw new Error('Unsupported architecture: ' + os.arch());
    }
  }
};

module.exports = Downloader;
