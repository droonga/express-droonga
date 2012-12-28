var express = require('express')
  , app = express.application;

var fluent = require('fluent-logger');

var callbacks = {};
var socketio = null;

function register_callback(callback) {
  var res = this.message_id || 0;
  res += 1;
  callbacks[res] = callback;
  this.message_id = res;
  return res;
}

function rest_request_handler(req, res) {
  /* todo: should be abstracted */
  var message = {
    body: {
      params: req.params,
      query: req.query,
      body: req.body,
      cookies: req.cookies
    }
  };
  if (req.query.volatile) {
    res.send('accepted');
  } else {
    var message_id = register_callback(function(data) {
      res.contentType('application/json');
      res.send(JSON.stringify(data.body));
    });
    message["reply_to"] = {
      type: "rest",
      message_id: message_id
    },
  }
  fluent.emit('message', message);
}

function socketio_connection_handler(socket) {
  socket.on('message', function (data) {
    if (data.to) {
      switch (data.to.type) {
      case "socketio" :
        if (data.to.session_id) {
          var socket = socketio.sockets.socket(data.to.session_id);
          if (socket) {
            socket.send(data.body);
          } else {
            /* closed? */
          }
        } else {
          /* todo: broadcast */
        }
        break;
      default :
        var message_id = data.to.message_id;
        if (callbacks[message_id]) {
          callbacks[message_id](data);
          delete callbacks(message_id);
        } else {
          /* timeout? */
        }
        break;
      }
    } else {
      var message = {
        body: data
      };
      if (!data.query.volatile) {
        message["reply_to"] =  {
          type: "socketio",
          session_id: socket.id;
        }
      }
      fluent.emit('message', message);
    }
  });
}

app.kotoumi = function(name, io, opts) {
  fluent.configure(
    opts.fluent_tag || 'kotoumi',
    {host: opts.fluent_host || 'localhost',
     port: opts.fluent_port || 24224});
  if (name == '/') {
    io.sockets.on('connection', socketio_connection_handler);
  } else {
    io.of(name).on('connection', socketio_connection_handler);
  }
  app.all(name + '*', rest_request_handler);
  socketio = io;
}

exports.emit = function(req, callback) {
  var message = {
    body: req
  };
  if (callback) {
    message["reply_to"] = {
      type: "application",
      message_id: register_callback(callback);
    }
  }
  fluent.emit('message', message);
}
