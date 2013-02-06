var requestBuilders = require('./rest-request-builder');

module.exports = {
//  'status': {
//    path: '/status/:target',
//    requestBuilder: requestBuilders.status
//  },
  'search': {
    path: '/tables/:tableName',
    requestBuilder: requestBuilders.search
  } //,
//  'createtable': {
//    method: 'PUT',
//    path: '/tables/:tableName',
//    requestBuilder: requestBuilders.createTable
//  },
//  'removetable': {
//    method: 'DELETE',
//    path: '/tables/:tableName',
//    requestBuilder: requestBuilders.removeTable
//  },
//  'createcolumn': {
//    method: 'PUT',
//    path: '/tables/:tableName/columns/:columnName',
//    requestBuilder: requestBuilders.createColumn
//  },
//  'removecolumn': {
//    method: 'DELETE',
//    path: '/tables/:tableName/columns/:columnName',
//    requestBuilder: requestBuilders.removeColumn
//  },
//  'loadrecord': {
//    method: 'PUT',
//    path: '/tables/:tableName/records/:key',
//    requestBuilder: requestBuilders.loadRecord
//  },
//  'loadrecords': {
//    method: 'PUT',
//    path: '/tables/:tableName/records',
//    requestBuilder: requestBuilders.loadRecords
//  }
};
