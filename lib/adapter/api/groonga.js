var command = require('../command');
var jsonParser = require('jsonparse');

var statusCodes = {
  SUCCESS: 0
};

function Loader(request, response, connection) {
  this._request = request;
  this._response = response;
  this._connection = connection;
  if (request.query.columns) {
    this._columns = request.query.columns.split(/[,\s]+/);
  }
}

Loader.prototype.run = function run() {
  this._jsonParser = new jsonParser();
  this._statusCode = statusCodes.SUCCESS;
  this._startTimeInMilliseconds = Date.now();
  this._nRecords = 0;
  this._nResponses = 0;
  this._nAdded = 0;
  this._isEnd = false;

  this._jsonParser.onValue = this._onValue.bind(this);
  this._request.on('data', function(chunk) {
    this._jsonParser.write(chunk);
  }.bind(this));
  this._request.once('end', function() {
    this._isEnd = true;

    if (this._nRecords == 0) {
      this._sendResponse([0]);
    }
  }.bind(this));
};

Loader.prototype._onValue = function(value) {
  if (this._jsonParser.stack.length != 1) {
    return;
  }

  if (Array.isArray(value) && !this._columns) {
    this._columns = value;
    return;
  }

  var message = {
    table: this._request.query.table, // TODO: validate it
    values: {}
  };

  this._nRecords++;

  if (Array.isArray(value)) {
    this._columns.forEach(function(column, i) {
      if (column == '_key') {
        message.key = value[i];
      } else {
        message.values[column] = value[i];
      }
    });
  } else {
    Object.keys(value).forEach(function(key) {
      if (key == '_key') {
        message.key = value[key];
      } else {
        message.values[key] = value[key];
      }
    });
  }

  this._connection.emit('add', message, function(error, message) {
    this._nResponses++;
    if (error) {
      // TODO: Output to error log file.
      console.error("/d/load: failed to add a record", message);
    } else {
      var succeeded = message;
      if (succeeded) {
        this._nAdded++;
      }
    }
    if (this._isEnd && this._nRecords == this._nResponses) {
      this._sendResponse([this._nAdded]);
    }
  }.bind(this));
};

Loader.prototype._createResponse = function(body) {
  var elapsedTimeInMilliseconds = Date.now() - this._startTimeInMilliseconds;
  var header = [
    this._statusCode,
    this._startTimeInMilliseconds / 1000,
    elapsedTimeInMilliseconds / 1000,
  ];
  return [header, body];
};

Loader.prototype._sendResponse = function sendResponse(body) {
  var groongaResponse = this._createResponse(body);
  this._response.jsonp(groongaResponse);
};

module.exports = {
  'groonga': new command.HTTPRequestResponse({
    path: '/d/:commandName',
    onRequest: function(request, connection) {
      connection.emit(request.params.commandName, request.query);
    }
  }),
  'groonga-load': new command.HTTPRequestResponse({
    method: 'POST',
    path:   '/d/load',
    onRequest: function(request, connection, response) {
      var loader = new Loader(request, response, connection);
      loader.run();
    }
  })
};
