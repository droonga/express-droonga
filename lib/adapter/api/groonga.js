var command = require('../command');
var jsonParser = require('jsonparse');

var statusCodes = {
  SUCCESS: 0
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
      var parser = new jsonParser();
      var nRecords = 0;
      var nResponses = 0;
      var nAdded = 0;
      var isEnd = false;
      var startTimeInMilliseconds = Date.now();

      parser.onValue = function(value) {
        if (parser.stack.length != 1) {
          return;
        }

        nRecords++;
        var message = {
          table: request.query.table, // TODO: validate it
          key: value._key,
          values: {}
        };
        connection.emit('add', message, function(error, message) {
          nResponses++;
          if (error) {
            // TODO: Output to error log file.
            console.error("/d/load: failed to add a record", message);
          } else {
            var succeeded = message;
            if (succeeded) {
              nAdded++;
            }
          }
          if (isEnd && nRecords == nResponses) {
            var statusCode = statusCodes.SUCCESS;
            var elapsedTimeInMilliseconds =
              Date.now() - startTimeInMilliseconds;
            var header = [
              statusCode,
              startTimeInMilliseconds / 1000,
              elapsedTimeInMilliseconds / 1000,
            ];
            response.jsonp([header, [nAdded]]);
          }
        });
      };
      request.on('data', function(chunk) {
        parser.write(chunk);
      });
      request.once('end', function() {
        isEnd = true;
      });
    }
  })
};
