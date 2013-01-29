var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');

var Receiver = require('../lib/backend/receiver').Receiver;

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
        return utils.sendPacketTo(rawPacket, receiver.port);
      })
      .next(function() {
        mockedReceiver.assertThrows();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('re-connecting', function(done) {
    var mockedReceiver = nodemock
          .mock('start')
          .mock('receive')
            .takes({ message1: true })
          .mock('receive')
            .takes({ message2: true });

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

        var rawPacket = { tag: 'kotoumi.message', data: { message1: true } };
        return utils.sendPacketTo(rawPacket, receiver.port);
      })
      .next(function() {
        var rawPacket = { tag: 'kotoumi.message', data: { message2: true } };
        return utils.sendPacketTo(rawPacket, receiver.port);
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

