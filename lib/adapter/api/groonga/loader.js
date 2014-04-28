var jsonParser = require('jsonparse');

var statusCodes = {
  SUCCESS: 0,
  INVALID_ARGUMENT: -22
};
var httpStatusCodes = {
  OK: 200,
  BAD_REQUEST: 400
};

function Loader(request, response, connection, logger) {
  this._request = request;
  this._response = response;
  this._connection = connection;
  this._logger = logger
  this._errorMessage = undefined;
}

Loader.prototype.run = function run() {
  this._startTimeInMilliseconds = Date.now();
  this._statusCode = statusCodes.SUCCESS;

  try {
    this._extractParameters();
  } catch (error) {
    this._statusCode = error.statusCode;
    this._errorMessage = error.message;
    this._sendResponse([0]);
    return;
  }

  this._jsonParser = new jsonParser();
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

Loader.prototype._extractParameters = function _extractParameters() {
  var query = this._request.query;

  this._table = query.table;
  if (!this._table) {
    throw {
      statusCode: statusCodes.INVALID_ARGUMENT,
      message: 'required parameter is missing: <table>',
      httpStatusCode: httpStatusCodes.BAD_REQUEST
    };
  }

  if (query.columns) {
    this._columns = query.columns.split(/[,\s]+/);
  } else {
    this._columns = null;
  }
};

Loader.prototype._onValue = function _onValue(value) {
  if (this._jsonParser.stack.length != 1) {
    return;
  }

  if (Array.isArray(value) && !this._columns) {
    this._columns = value;
    return;
  }

  var message = {
    table: this._table,
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
      this._logger.error("/d/load: failed to add a record", message);
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

Loader.prototype._createResponse = function _createResponse(body) {
  var elapsedTimeInMilliseconds = Date.now() - this._startTimeInMilliseconds;
  var header = [
    this._statusCode,
    this._startTimeInMilliseconds / 1000,
    elapsedTimeInMilliseconds / 1000,
  ];
  if (this._errorMessage) {
    header.push(this._errorMessage);
  }
  return [header, body];
};

Loader.prototype._sendResponse = function _sendResponse(body) {
  var groongaResponse = this._createResponse(body);
  var groongaResponseHeader = groongaResponse[0];
  var httpStatusCode;
  if (groongaResponseHeader[0] == statusCodes.SUCCESS) {
    httpStatusCode = httpStatusCodes.OK;
  } else {
    httpStatusCode = httpStatusCodes.BAD_REQUEST;
  }
  this._response.jsonp(groongaResponse, httpStatusCode);
};

module.exports = Loader;
