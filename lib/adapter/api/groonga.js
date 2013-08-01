var command = require('../command');

module.exports = {
  'groonga': new command.HTTPCommand({
    path: '/d/:commandName',
    onRequest: function(request, connection) {
      connection.emit(request.params.commandName, request.query);
    }
  })
};
