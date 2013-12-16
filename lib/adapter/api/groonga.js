var command = require('../command');

module.exports = {
  'groonga': new command.HTTPRequestResponse({
    path: '/d/:commandName',
    onRequest: function(request, connection) {
      connection.emit(request.params.commandName, request.query);
    }
  })
};
