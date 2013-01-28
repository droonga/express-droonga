var assert = require('chai').assert;
var nodemock = require('nodemock');
var net = require('net');
var msgpack = require('msgpack');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');

var Receiver = require('../lib/backend/receiver').Receiver;

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

function sendPacketTo(packet, port) {
  return connectTo(port)
    .next(function(clientSocket) {
      var packedPacket = msgpack.pack(packet);
      clientSocket.write(new Buffer(packedPacket));
      return clientSocket;
    })
    .next(function(clientSocket) {
      clientSocket.destroy();
    });
}

suite('Receiver', function() {
  var receiver;

  teardown(function() {
    if (receiver) {
      receiver.close();
      receiver = undefined;
    }
  });

  test('receiving packed message', function(done) {
    var mockedReceiver = nodemock
          .mock('start')
          .mock('receive')
            .takes({ message: true });

    receiver = new Receiver();
    receiver.on('kotoumi.message', function(data) {
      mockedReceiver.receive(data);
    });
    receiver.listen(function() {
      mockedReceiver.start();
    });

    Deferred
      .wait(0.01)
      .next(function() {
        assert.notEqual(receiver.port, undefined);

        var rawPacket = { tag: 'kotoumi.message', data: { message: true } };
        return sendPacketTo(rawPacket, receiver.port);
      })
      .next(function() {
        mockedReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

