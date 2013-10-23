var command = require('../command');

module.exports = {
//  'status': {},

  'search': new command.SocketRequestResponse(),
  'watch': new command.SocketPublishSubscribe({
    onSubscribe: function(data, connection) {
      data.route = data.route || connection.routeToSelf;
      data.subscriber = data.subscriber || command.sha1sum(data.route);
      connection.emit('watch.subscribe', data);
    },
    onUnsubscribe: function(data, connection) {
      data.route = data.route || connection.routeToSelf;
      data.subscriber = data.subscriber || command.sha1sum(data.route);
      connection.emit('watch.unsubscribe', data);
    },
    notification: 'watch.notification', 
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
