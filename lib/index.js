var express = require('express');
var Connection = require('./backend-adaptor').Connection;
var builders = request('./builders');

express.application.kotoumi = function(params) {
  params = params || {};
  var connection = new Connection(params);

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  var handlersFactory = params.handlers;

  function createDefaultHandler(type, connection) {
    return (function(request, response) {
      var builder = builders.requestInREST[type];
      if (!builder) throw new Error('no request builder for ' + type);

      var message = builder(request);
      connection.sendMessage(type, message, function(responseMessage) {
        var builder = builders.response[type];
        if (!builder) throw new Error('no response builder for ' + type);

        response.write(builder(responseMessage));
      });
    });
  }

  function createHandler(type) {
    return (
      (
        handlersFactory &&
        typeof handlersFactory[type] == 'function' &&
        handlersFactory[type](connection)
      ) ||
      createDefaultHandler(type, connection)
    );
  }

  this.get(prefix + '/status/:target', createHandler('status'));

  this.get(prefix + '/tables/:tableName', createHandler('search'));

  this.put(prefix + '/tables/:tableName', createHandler('createTable'));
  this.del(prefix + '/tables/:tableName', createHandler('removeTable'));

  this.put(prefix + '/tables/:tableName/columns/:columnName', createHandler('createColumn'));
  this.del(prefix + '/tables/:tableName/columns/:columnName', createHandler('removeColumn'));

  this.put(prefix + '/tables/:tableName/records/:key', createHandler('loadRecord'));
  this.post(prefix + '/tables/:tableName/records', createHandler('loadRecords'));
}
