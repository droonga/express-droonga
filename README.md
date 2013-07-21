"Droonga" (distributed-groonga) is built with the part of frontend named
"express-droonga" and the part of backend named "fluent-plugin-droonga".


# express-droonga

  express-droonga provides a framework for building scalable
  realtime web API services for Express.

# usage

## server

If both express-droonga and fluentd are running on the same machine,
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
        // extra command will be sent to fluentd via the Socket.IO API, as is.
        'droonga.reindex'
      ]
    });

Otherwise, you have to specify pairs of host and port to send messages
to the fluentd and to receive messages from the fluentd.

    application.droonga({
      prefix: '/droonga',
      tag:    'droonga',
      server: server,
      extraCommands: [
        'droonga.reindex'
      ],
    
      // host and port to send messages to fluentd
      hostName: 'backend.droonga.example.org',
      port:     24224,

      // host and port to receive messages from fluentd
      receiveHostName: 'express.droonga.example.org',
      receivePort:     10030
    });


## client (REST)

Frontend applications can call REST APIs to access resources stored in
the droonga. For example:

    GET /droonga/tables/entries?query=foobar HTTP/1.1

It works as a search request, and a JSON string will be returned as the result.

## client (Socket.IO)

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

Copyright (c) 2013 Droonga project
