var model = require('../../model');
var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': new model.HTTPCommand({
//    path: '/status/:target',
//    toBackend: requestBuilders.status
//  }),
  'search': new model.HTTPCommand({
    path: '/tables/:tableName',
    toBackend: function(event, request) {
      return [event, requestBuilders.search(request)];
    }
  }) //,
//  'createtable': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName',
//    toBackend: requestBuilders.createTable
//  }),
//  'removetable': new model.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    toBackend: requestBuilders.removeTable
//  }),
//  'createcolumn': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    toBackend: requestBuilders.createColumn
//  }),
//  'removecolumn': new model.HTTPCommand({
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    toBackend: requestBuilders.removeColumn
//  }),
//  'loadrecord': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    toBackend: requestBuilders.loadRecord
//  }),
//  'loadrecords': new model.HTTPCommand({
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    toBackend: requestBuilders.loadRecords
//  })
};
