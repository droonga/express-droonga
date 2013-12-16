var command = require('../command');
var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': new command.RequestResponseHTTPCommand({
//    path: '/status/:target',
//    onRequest: function(request, connection) {
//      connection.emit('status', requestBuilders.status(request));
//    }
//  }),
  'search': new command.RequestResponseHTTPCommand({
    path: '/tables/:tableName',
    onRequest: function(request, connection) {
      connection.emit('search', requestBuilders.search(request));
    }
  }) //,
//  'createtable': new command.RequestResponseHTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName',
//    onRequest: function(request, connection) {
//      connection.emit('createtable', requestBuilders.createTable(request));
//    }
//  }),
//  'removetable': new command.RequestResponseHTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    onRequest: function(request, connection) {
//      connection.emit('removetable', requestBuilders.removeTable(request));
//    }
//  }),
//  'createcolumn': new command.RequestResponseHTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    onRequest: function(request, connection) {
//      connection.emit('createcolumn', requestBuilders.createColumn(request));
//    }
//  }),
//  'removecolumn': new command.RequestResponseHTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    onRequest: function(request, connection) {
//      connection.emit('removecolumn', requestBuilders.removeColumn(request));
//    }
//  }),
//  'loadrecord': new command.RequestResponseHTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    onRequest: function(request, connection) {
//      connection.emit('loadrecord', requestBuilders.loadRecord(request));
//    }
//  }),
//  'loadrecords': new command.RequestResponseHTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    onRequest: function(request, connection) {
//      connection.emit('loadrecords', requestBuilders.loadRecords(request));
//    }
//  })
};
