var command = require('../../command');
var Loader = require('./loader');

var SUFFIX_PATTERN = /\.([^\.]+)$/;

function normalizeCommandName(commandName) {
  if (SUFFIX_PATTERN.test(commandName)) {
    commandName = commandName.replace(SUFFIX_PATTERN, '');
    if (RegExp.$1 != 'json')
      throw new Error('unsupported output type');
  }
  return commandName;
}

function handleGetRequest(request, connection) {
  var commandName = normalizeCommandName(request.params.commandName);
  connection.emit(commandName, request.query);
}

function handlePostRequest(request, connection, response) {
  var commandName = normalizeCommandName(request.params.commandName);
  if (commandName == 'load') {
    var loader = new Loader(request, response, connection, this.logger);
    loader.run();
  } else {
    connection.emit(commandName, request.query);
  }
}

module.exports = {
  'groonga': new command.HTTPRequestResponse({
    path: '/d/:commandName',
    onRequest: handleGetRequest
  }),
  'groonga-post': new command.HTTPRequestResponse({
    path: '/d/:commandName',
    method: 'POST',
    onRequest: handlePostRequest
  })
};
