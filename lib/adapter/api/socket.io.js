var command = require('../command');

module.exports = {
//  'status': {},

  'search': new command.SocketRequestResponse(),
  'watch': new command.SocketPublishSubscribe({})//,    

//  'createtable': {},
//  'removetable': {},
//  'createcolumn': {},
//  'removecolumn': {},
//  'loadrecord': {},
//  'loadrecords': {}
};
