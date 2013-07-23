var model = require('./model');
var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': new model.HTTPCommand({
//    path: '/status/:target',
//    requestConverter: requestBuilders.status
//  }),
  'search': new model.HTTPCommand({
    path: '/tables/:tableName',
    requestConverter: function(event, request) {
      return [event, requestBuilders.search(request)];
    }
  }) //,
//  'createtable': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName',
//    requestConverter: requestBuilders.createTable
//  }),
//  'removetable': new model.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    requestConverter: requestBuilders.removeTable
//  }),
//  'createcolumn': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    requestConverter: requestBuilders.createColumn
//  }),
//  'removecolumn': new model.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    requestConverter: requestBuilders.removeColumn
//  }),
//  'loadrecord': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    requestConverter: requestBuilders.loadRecord
//  }),
//  'loadrecords': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    requestConverter: requestBuilders.loadRecords
//  })
};
