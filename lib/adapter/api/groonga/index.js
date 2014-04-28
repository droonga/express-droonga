var command = require('../../command');
var Loader = require('./loader');

function handleHTTPRequest(request, connection) {
  connection.emit(request.params.commandName, request.query);
}

function handleLoadHTTPRequest(request, connection) {
  var loader = new Loader(request, response, connection, this.logger);
  loader.run();
}

module.exports = {
  'groonga': new command.HTTPRequestResponse({
    path: '/d/:commandName',
    onRequest: handleHTTPRequest
  }),
  'groonga-json': new command.HTTPRequestResponse({
    path: '/d/:commandName.json',
    onRequest: handleHTTPRequest
  }),
  'groonga-load': new command.HTTPRequestResponse({
    method: 'POST',
    path:   '/d/load',
    onRequest: handleLoadHTTPRequest
  }),
  'groonga-load-json': new command.HTTPRequestResponse({
    method: 'POST',
    path:   '/d/load.json',
    onRequest: handleLoadHTTPRequest
  })
};
