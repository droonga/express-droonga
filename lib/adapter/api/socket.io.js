var command = require('../command');
var crypto = require('crypto');

module.exports = {
//  'status': {},

  'search': new command.SocketRequestResponse(),

  'watch': new command.SocketPublishSubscribe({
    onSubscribe: function(data, connection) {
      data.subscriber = /* data.subscriber || */ command.sha1sum(connection.routeToSelf);
      data.route = /* data.route || */ connection.routeToSelf;
      connection.emit('watch.subscribe', data);
    },
    onSubscribeResponse: function(data, socket) {
      socket.emit('watch.subscribe.response', data);
    },
    onUnsubscribe: function(data, connection) {
      data.subscriber = /* data.subscriber || */ command.sha1sum(connection.routeToSelf);
      data.route = /* data.route || */ connection.routeToSelf;
      connection.emit('watch.unsubscribe', data);
    },
    onUnsubscribeResponse: function(data, socket) {
      socket.emit('watch.unsubscribe.response', data);
    },
    onNotify: function(data, socket) {
      socket.emit('watch.notification', data);
    }
  })//,    

//  'createtable': {},
//  'removetable': {},
//  'createcolumn': {},
//  'removecolumn': {},
//  'loadrecord': {},
//  'loadrecords': {}
};
