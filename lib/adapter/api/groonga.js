var model = require('../../model');

module.exports = {
  'groonga': new model.HTTPCommand({
    path: '/d/:commandName',
    toBackend: function(commandName, request) {
      return [request.params.commandName, request.query];
    }
  })
};
