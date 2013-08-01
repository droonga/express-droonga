var command = require('../command');

module.exports = {
  'groonga': new command.HTTPCommand({
    path: '/d/:commandName',
    requestConverter: function(commandName, request) {
      return [request.params.commandName, request.query];
    }
  })
};
