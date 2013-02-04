var assert = require('chai').assert;
var nodemock = require('nodemock');
var net = require('net');
var msgpack = require('msgpack');
var http = require('http');
var Deferred = require('jsdeferred').Deferred;
var client = require('socket.io-client');

var socketIoHandler = require('../lib/frontend/socket.io-handler');

var testSendPort = exports.testSendPort = 3333;
var testReceivePort = exports.testReceivePort = 3334;
var testServerPort = exports.testServerPort = 3335;


function connectTo(port) {
  var deferred = new Deferred();
  var clientSocket = new net.Socket();
  clientSocket.on('error', function(error){
    clientSocket.destroy();
    deferred.fail(error);
  });
  clientSocket.connect(port, 'localhost', function(){
    deferred.call(clientSocket);
  });
  return deferred;
}
exports.connectTo = connectTo;
Deferred.register('connectTo', function() { return connectTo.apply(this, arguments); });

function sendPacketTo(packet, port) {
  var clientSocket;
  return connectTo(port)
    .next(function(newSocket) {
      clientSocket = newSocket;
      var packedPacket = msgpack.pack(packet);
      clientSocket.write(new Buffer(packedPacket));
    })
    .wait(0.01)
    .next(function() {
      clientSocket.destroy();
      clientSocket = undefined;
    })
    .error(function(error) {
      if (clientSocket) {
        clientSocket.destroy();
        clientSocket = undefined;
      }
      throw error;
    });
}
exports.sendPacketTo = sendPacketTo;
Deferred.register('sendPacketTo', function() { return sendPacketTo.apply(this, arguments); });


function setupServer(handlerOrServer) {
  var deferred = new Deferred();
  var server;
  if ('close' in handlerOrServer) { // it is a server
    server = handlerOrServer;
  } else { // it is a handler
    server = http.createServer(handlerOrServer);
  }
  server.listen(testServerPort, function() {
    deferred.call(server);
  });
  return deferred;
}
exports.setupServer = setupServer;

function sendRequest(method, path, postData, headers) {
  var deferred = new Deferred();

  var options = {
        host: 'localhost',
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

  Deferred.next(function() {
    var request = http.request(options, function(response) {
          var body = '';
          response.on('data', function(data) {
            body += data;
          });
          response.on('end', function() {
            deferred.call({
              statusCode: response.statusCode,
              body: body
            });
          });
        });
    request.on('error', function(error) {
      deferred.fail(error);
    });

    if (postData) request.write(postData);
    request.end();
  });

  return deferred;
}

function get(path, headers) {
  return sendRequest('GET', path, null, headers);
}
exports.get = get;
Deferred.register('get', function() { return get.apply(this, arguments); });

function post(path, body, headers) {
  return sendRequest('POST', path, body, headers);
}
exports.post = post;
Deferred.register('post', function() { return post.apply(this, arguments); });


function createClientSocket() {
  var deferred = new Deferred();
  var host = 'http://localhost:' + testServerPort;
  var options = { 'force new connection': true };
  var socket = client.connect(host, options);
  socket.on('connect', function() {
    deferred.call(socket);
  });
  return deferred;
}
exports.createClientSocket = createClientSocket;

function createMockedBackendConnection() {
  var connection = nodemock;
  var onMessageControllers = {};
  socketIoHandler.commands.forEach(function(command) {
    onMessageControllers[command] = {};
    connection = connection
      .mock('on')
        .takes('message', function() {})
        .ctrl(1, onMessageControllers[command]);
  });

  onMessageControllers.error = {};
  connection = connection
    .mock('on')
      .takes('error', function() {})
      .ctrl(1, onMessageControllers.error);

  connection.controllers = onMessageControllers;
  return connection;
}
exports.createMockedBackendConnection = createMockedBackendConnection;

function createStubbedBackendConnection() {
  return {
    emitMessage: function() {},
    emit: function() {},
    on: function() {},
    removeListener: function(),
    removeAllListeners: function()
  };
}
exports.createStubbedBackendConnection = createStubbedBackendConnection;

function readyToDestroyMockedConnection(connection) {
  connection = connection
    .mock('removeListener')
      .takes('message', function() {})
      .times(socketIoHandler.commands.length)
    .mock('removeListener')
      .takes('error', function() {});
  return connection;
}
exports.readyToDestroyMockedConnection = readyToDestroyMockedConnection;

function createMockedHandlersFactory() {
  return nodemock
    .mock('search')
    .takes({})
    .returns(function() {});
}
exports.createMockedHandlersFactory = createMockedHandlersFactory;


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

exports.outputAll = {
  startTime:   true,
  elapsedTime: true,
  count:       true,
  attributes:  true,
  recodes:     true
};
