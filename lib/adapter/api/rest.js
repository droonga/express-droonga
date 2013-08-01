var command = require('../command');
var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': new command.HTTPCommand({
//    path: '/status/:target',
//    onRequest: function(request, connection) {
//      connection.emit('status', requestBuilders.status(request));
//    }
//  }),
  'search': new command.HTTPCommand({
    path: '/tables/:tableName',
    onRequest: function(request, connection) {
      connection.emit('search', requestBuilders.search(request));
    }
  }) //,
//  'createtable': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName',
//    onRequest: function(request, connection) {
//      connection.emit('createtable', requestBuilders.createTable(request));
//    }
//  }),
//  'removetable': new command.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    onRequest: function(request, connection) {
//      connection.emit('removetable', requestBuilders.removeTable(request));
//    }
//  }),
//  'createcolumn': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    onRequest: function(request, connection) {
//      connection.emit('createcolumn', requestBuilders.createColumn(request));
//    }
//  }),
//  'removecolumn': new command.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    onRequest: function(request, connection) {
//      connection.emit('removecolumn', requestBuilders.removeColumn(request));
//    }
//  }),
//  'loadrecord': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    onRequest: function(request, connection) {
//      connection.emit('loadrecord', requestBuilders.loadRecord(request));
//    }
//  }),
//  'loadrecords': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    onRequest: function(request, connection) {
//      connection.emit('loadrecords', requestBuilders.loadRecords(request));
//    }
//  })
};
