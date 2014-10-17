var assert = require('chai').assert;
var nodemock = require('nodemock');
var net = require('net');
var msgpack = require('msgpack');
var http = require('http');
var Q = require('q');
var socketIoClient = require('socket.io-client');
var express = require('express');
var url = require('url');

var FluentReceiver = require('../lib/droonga-protocol/receiver').FluentReceiver;
exports.FluentReceiver = FluentReceiver;

var Connection = require('../lib/droonga-protocol/connection').Connection;
var ConnectionPool = require('../lib/droonga-protocol/connection-pool').ConnectionPool;

var ConsoleLogger = require('../lib/console-logger').ConsoleLogger;
var logger = new ConsoleLogger();

var testSendPort = exports.testSendPort = 3333;
var testReceivePort = exports.testReceivePort = 3334;
var testServerPort = exports.testServerPort = 3335;
var testTag = exports.testTag = 'test';

function registerCallbackGenerator(name) {
  exports[name + 'Cb'] = (function() {
    var givenArgs = arguments;
    return (function() {
      return exports[name].apply(exports, givenArgs);
    });
  });
}


function wait(seconds) {
  return Q.Promise(function(resolve, reject, notify) {
    setTimeout(resolve, seconds * 1000);
  });
}
exports.wait = wait;
registerCallbackGenerator('wait');

function connectTo(port) {
  return Q.Promise(function(resolve, reject, notify) {
    var clientSocket = new net.Socket();
    clientSocket.on('error', function(error){
      clientSocket.destroy();
      reject(error);
    });
    clientSocket.connect(port, '127.0.0.1', function(){
      resolve(clientSocket);
    });
  });
}
exports.connectTo = connectTo;
registerCallbackGenerator('connectTo');

function sendPacketTo(packet, port) {
  var clientSocket;
  return connectTo(port)
    .then(function(newSocket) {
      clientSocket = newSocket;
      var packedPacket = msgpack.pack(packet);
      clientSocket.write(new Buffer(packedPacket));
    })
    .then(exports.waitCb(0.01))
    .then(function() {
      clientSocket.destroy();
      clientSocket = undefined;
    })
    .catch(function(error) {
      if (clientSocket) {
        clientSocket.destroy();
        clientSocket = undefined;
      }
      throw error;
    });
}
exports.sendPacketTo = sendPacketTo;
registerCallbackGenerator('sendPacketTo');


function setupServer(handlerOrServer) {
  return Q.Promise(function(resolve, reject, notify) {
    var server;
    if ('close' in handlerOrServer) { // it is a server
      server = handlerOrServer;
    } else { // it is a handler
      server = http.createServer(handlerOrServer);
    }
    server.listen(testServerPort, function() {
      resolve(server);
    });
  });
}
exports.setupServer = setupServer;
registerCallbackGenerator('setupServer');

function normalizePath(path) {
  if (typeof path != 'string') {
    path = url.format(path);
  }
  return path;
}

function sendRequest(method, path, postData, headers) {
  return Q.Promise(function(resolve, reject, notify) {
    path = normalizePath(path);
    var options = {
          host: '127.0.0.1',
          port: testServerPort,
          path: path,
          method: method,
          headers: {}
        };

    if (headers) {
      for (var header in headers) {
        if (headers.hasOwnProperty(header))
          options.headers[header] = headers[header];
      }
    }

    var request = http.request(options, function(response) {
          var body = '';
          response.on('data', function(data) {
            body += data;
          });
          response.on('end', function() {
            resolve({
              statusCode: response.statusCode,
              body: body
            });
          });
        });
    request.on('error', function(error) {
      reject(error);
    });

    if (postData) request.write(postData);
    request.end();
  });
}

function get(path, headers) {
  return sendRequest('GET', path, null, headers);
}
exports.get = get;
registerCallbackGenerator('get');

function post(path, body, headers) {
  return sendRequest('POST', path, body, headers);
}
exports.post = post;
registerCallbackGenerator('post');


function createClient() {
  return Q.Promise(function(resolve, reject, notify) {
    var endpoint = 'http://127.0.0.1:' + testServerPort;
    var options = {
      'transports': ['websocket', 'polling'],
      'force new connection': true
    };
    var socket = socketIoClient(endpoint, options);
    var newClientSocket;
//    socket.on('connect', function() {
//      resolve(socket);
//    });
    socket.on('connected', function(client) {
      client.socket = socket;
      resolve(client);
    });
    socket.on('error', function(error) {
      reject(new Error(JSON.stringify(error)));
    });
  });
}
exports.createClient = createClient;
registerCallbackGenerator('createClient');

function createClients(count) {
  return Q.Promise(function(resolve, reject, notify) {
    var clients = [];
    for (var i = 0; i < count; i++) {
      createClient().then(function(client) {
        clients.push(client);
        if (clients.length == count)
          resolve(clients);
      });
    }
  });
}
exports.createClients = createClients;
registerCallbackGenerator('createClients');

function createStubbedBackendConnection(hostName) {
  hostName = hostName || '127.0.0.1';
  return {
    hostName: hostName,
    port: testReceivePort,
    tag: testTag,

    emitMessage: function(type, message, callback, options) {
      if (typeof callback != 'function') {
        callback = null;
        options = callback;
      }

      var args = {
        type:    type,
        message: message
      };
      if (callback)
        args.callback = callback;
      if (Object.keys(options).length > 0)
        args.options = options;

      this.emitMessageCalledArguments.push(args);

      if (typeof callback == 'function') {
        callback(null, {
          type: type + '.result',
          body: message
        });
      }
    },
    emitMessageCalledArguments: [],
    getRouteToSelf: function() {
      return hostName + ':' + testReceivePort + '/' + testTag;
    },

    emit: function() {},
    on: function() {},
    removeListener: function() {},
    removeAllListeners: function() {},
    close: function() {}
  };
}
exports.createStubbedBackendConnection = createStubbedBackendConnection;

function createStubbedBackendConnectionPool(count) {
  count = count || 1;
  var connections = [];
  for (var i = 0; i < count; i++) {
    connections.push(createStubbedBackendConnection('127.0.0.' + (i + 1)));
  }
  var index = 0;
  return {
    count: count,
    get: function() {
      var connection = connections[index];
      index++;
      if (index == count)
        index = 0;
      return connection;
    },
    closeAll: function() {},

    connections: connections
  };
}
exports.createStubbedBackendConnectionPool = createStubbedBackendConnectionPool;

function setupApplication() {
  var application = express();
  var server;
  var backend;
  return setupServer(application)
    .then(function(newServer) {
      server = newServer;
    })
    .then(exports.createBackendCb())
    .then(function(newBackend) {
      backend = newBackend;
      var connectionPool = new ConnectionPool({
        tag:      testTag,
        defaultDataset: 'test-dataset',
        hostName: ['127.0.0.1'],
        port:     testSendPort,
        receivePort: testReceivePort,
        maxRetyrCount: 3,
        retryDelay: 1
      });
      return {
        backend:     backend,
        server:      server,
        application: application,
        connectionPool: connectionPool
      };
    });
}
exports.setupApplication = setupApplication;
registerCallbackGenerator('setupApplication');

function teardownApplication(params) {
  params = params || {};
  if (params.backend) {
    params.backend.close();
    params.backend = undefined;
  }
  if (params.application && params.application.connectionPool) {
    params.application.connectionPool.closeAll();
    params.application = undefined;
  } else if (params.connectionPool) {
    params.connectionPool.closeAll();
    params.connectionPool = undefined;
  }
  if (params.server) {
    params.server.close();
    params.server = undefined;
  }
}
exports.teardownApplication = teardownApplication;

function createBackend() {
  return Q.Promise(function(resolve, reject, notify) {
    var backend = new FluentReceiver(testSendPort);

    backend.clearMessages = function() {
      this.received = [];
    };

    backend.clearMessages();
    backend.on('receive', function(data) {
      logger.debug('test-utils.createBackend.receive %d', backend._id);
      backend.received.push(data);
      if (backend.reservedResponses.length > 0) {
        var response = backend.reservedResponses.shift();
        if (typeof response == 'function')
          response = response(data);
        sendPacketTo(response, testReceivePort);
      }
    });

    backend.reservedResponses = [];
    backend.reserveResponse = function(response) {
      backend.reservedResponses.push(response);
    };

    backend.assertReceived = function(expectedMessages) {
      assert.deepEqual(this.getMessages().map(function(message) {
                         return { type: message.type,
                                  body: message.body };
                       }),
                       expectedMessages);
    };

    backend.getMessages = function() {
      return this.received.map(function(packet) {
        return packet[2];
      });
    };
    backend.getEvents = function() {
      return this.getMessages().map(function(envelope) {
        return envelope.type;
      });
    };
    backend.getBodies = function() {
      return this.getMessages().map(function(envelope) {
        return envelope.body;
      });
    };

    backend.sendMessage = function(type, body, options) {
      var response = createEnvelope(type, body);
      if (options && typeof options == 'object') {
        Object.keys(options).forEach(function(key) {
          response[key] = options[key];
        });
      }
      return sendPacketTo(createPacket(response), testReceivePort)
    };
    backend.sendResponse = function(request, type, body) {
      var response = createReplyEnvelope(request, type, body);
      return sendPacketTo(createPacket(response), testReceivePort)
    };

    backend.listen(function() {
      return resolve(backend);
    });
  });
}
exports.createBackend = createBackend;
registerCallbackGenerator('createBackend');


function createEnvelope(type, body, options) {
  options = options || {};
  var now = new Date();
  var envelope = {
    id:         now.getTime(),
    date:       now.toISOString(),
    from:       '127.0.0.1:' + testReceivePort + '/' + testTag,
    dataset:    options.dataset || 'test-dataset',
    type:       type,
    body:       body
  };
  return envelope;
}
exports.createEnvelope = createEnvelope;

function createExpectedEnvelope(type, body, options) {
  var envelope = createEnvelope(type, body);
  envelope.id = TypeOf('string');
  envelope.from = new RegExp('^' + envelope.from + '\\?connection_id=\\d+$');
  envelope.date = InstanceOf(Date);
  if (options && options.dataset)
    envelope.dataset = options.dataset;
  if (options && options.requireReply)
    envelope.replyTo = envelope.from;
  return envelope;
}
exports.createExpectedEnvelope = createExpectedEnvelope;

function createReplyEnvelope(message, type, body) {
  var response = createEnvelope(type, body);
  response.inReplyTo = message.id;
  return response;
}
exports.createReplyEnvelope = createReplyEnvelope;

function createPacket(message, tag) {
  tag = tag || 'test.message';
  return [tag, Date.now(), message];
}
exports.createPacket = createPacket;

function createReplyPacket(requestPacket, envelope) {
  var tag = requestPacket[0];
  var timestamp = Date.now();
  var requestEnvelope = requestPacket[2];
  var replyEnvelope = Object.create(envelope);
  replyEnvelope.inReplyTo = requestEnvelope.id;
  return [tag, timestamp, replyEnvelope];
}
exports.createReplyPacket = createReplyPacket;

function TypeOf(typeString) {
  if (!(this instanceof TypeOf))
    return new TypeOf(typeString);

  this.typeString = typeString;
  if (typeString == 'date') {
    return new InstanceOf(Date);
  }
}
exports.TypeOf = TypeOf;

function InstanceOf(constructor) {
  if (!(this instanceof InstanceOf))
    return new InstanceOf(constructor);

  this.constructorFunction = constructor;
}
exports.InstanceOf = InstanceOf;

function assertEnvelopeEqual(actual, expected) {
  var vs = JSON.stringify(actual) + ' vs ' + JSON.stringify(expected);
  Object.keys(expected).forEach(function(key) {
    var actualValue = actual[key];
    var expectedValue = expected[key];
    if (expectedValue instanceof InstanceOf) {
      if (typeof actualValue == 'string') {
        // Try fo parse the value and create new instance.
        // If this process is failed, it can be an invalid value.
        actualValue = new expectedValue.constructorFunction(actualValue);
      }
      assert.instanceOf(actualValue,
                        expectedValue.constructorFunction,
                        key + ' / ' + vs);
    } else if (expectedValue instanceof TypeOf) {
      assert.typeOf(typeof actualValue,
                    expectedValue.typeString,
                    key + ' / ' + vs);
    } else if (expectedValue.constructor.toString().indexOf('function RegExp') > -1) {
      assert.match(actualValue, expectedValue, key + ' / ' + vs);
    } else {
      assert.deepEqual(actualValue, expectedValue, key + ' / ' + vs);
    }
  });
}
assert.envelopeEqual = assertEnvelopeEqual;

function sortKeys(original) {
  if (!original || typeof original != 'object')
    return original;

  if (Array.isArray(original))
    return original.map(sortKeys);

  var sorted = {};
  Object.keys(original).sort().forEach(function(key) {
    sorted[key] = sortKeys(original[key]);
  });
  return sorted;
}

// assert.deepEqual fails when the order of hash keys are different,
// even if they are "eaual" as JSON objects.
function assertEqualJSON(actual, expected) {
  this.deepEqual(sortKeys(actual), sortKeys(expected));
}
assert.equalJSON = assertEqualJSON;

exports.allElements = [
  'startTime',
  'elapsedTime',
  'count',
  'attributes',
  'records'
];
