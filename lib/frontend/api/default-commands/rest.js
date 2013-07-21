var model = require('../../../model');
var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': new model.REST({
//    path: '/status/:target',
//    toBackend: requestBuilders.status
//  }),
  'search': new model.REST({
    path: '/tables/:tableName',
    toBackend: function(event, request) {
      return [event, requestBuilders.search(request)];
    }
  }) //,
//  'createtable': new model.REST({
//    method: 'PUT',
//    path: '/tables/:tableName',
//    toBackend: requestBuilders.createTable
//  }),
//  'removetable': new model.REST({
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    toBackend: requestBuilders.removeTable
//  }),
//  'createcolumn': new model.REST({
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    toBackend: requestBuilders.createColumn
//  }),
//  'removecolumn': new model.REST({
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    toBackend: requestBuilders.removeColumn
//  }),
//  'loadrecord': new model.REST({
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    toBackend: requestBuilders.loadRecord
//  }),
//  'loadrecords': new model.REST({
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    toBackend: requestBuilders.loadRecords
//  })
};
