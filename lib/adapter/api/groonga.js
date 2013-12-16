var command = require('../command');

module.exports = {
  'groonga': new command.RequestResponseHTTPCommand({
    path: '/d/:commandName',
    onRequest: function(request, connection) {
      connection.emit(request.params.commandName, request.query);
    }
  })
};
