var command = require('../command');
var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': new command.HTTPCommand({
//    path: '/status/:target',
//    requestConverter: requestBuilders.status
//  }),
  'search': new command.HTTPCommand({
    path: '/tables/:tableName',
    requestConverter: function(event, request) {
      return [event, requestBuilders.search(request)];
    }
  }) //,
//  'createtable': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName',
//    requestConverter: requestBuilders.createTable
//  }),
//  'removetable': new command.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    requestConverter: requestBuilders.removeTable
//  }),
//  'createcolumn': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    requestConverter: requestBuilders.createColumn
//  }),
//  'removecolumn': new command.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    requestConverter: requestBuilders.removeColumn
//  }),
//  'loadrecord': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    requestConverter: requestBuilders.loadRecord
//  }),
//  'loadrecords': new command.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    requestConverter: requestBuilders.loadRecords
//  })
};
