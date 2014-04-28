# README

"Droonga" (distributed-groonga) is built with the protocol adapter
part named "express-droonga" and the Droonga engine part named
"fluent-plugin-droonga". This is "express-droonga".

## About express-droonga

express-droonga provides a framework for building scalable realtime
Web API services for Express.

## Usage

### Server

If both express-droonga and droonga engine are running on the same machine,
you can initialize the express-droonga instance easily.

    var express = require('express'),
        droonga = require('express-droonga');
    
    var application = express();
    var server = require('http').createServer(application);
    server.listen(80); // the port to communicate with clients
    
    application.droonga({
      prefix: '/droonga',
      tag:    'droonga',
      server: server, // this is required to initialize Socket.IO API!
      extraCommands: [ // optional
        // extra command will be sent to droonga engine via the Socket.IO API, as is.
        'droonga.reindex'
      ]
    });

Otherwise, you have to specify pairs of host and port to send messages
to the engine and to receive messages from the engine.

    application.droonga({
      prefix: '/droonga',
      tag:    'droonga',
      server: server,
      extraCommands: [
        'droonga.reindex'
      ],
    
      // host and port to send messages to the engine
      hostName: 'backend.droonga.example.org',
      port:     24224,

      // host and port to receive messages from the engine
      receiveHostName: 'express.droonga.example.org',
      receivePort:     10030
    });


### Client (REST)

Frontend applications can call REST APIs to access resources stored in
the droonga. For example:

    GET /droonga/tables/entries?query=foobar HTTP/1.1

It works as a search request, and a JSON string will be returned as the result.

### Client (Socket.IO)

Frontend applications can call raw APIs via Socket.IO. For example:

    var socket = io.connect('http://example.com:80');
    socket.on('search.result', function(data) {
      var records = data.body.records;
      ...
    });
    socket.emit('search', { query: 'foobar' });

In Socket.IO APIs, you'll send requests and receive results separately.

## License

The MIT License. See LICENSE for details.

Copyright (c) 2013-2014 Droonga project
