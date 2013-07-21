var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../test-utils');

var FluentReceiver = require('../../lib/backend/receiver').FluentReceiver;

suite('FluentReceiver', function() {
  var receiver;

  teardown(function() {
    if (receiver) {
      receiver.close();
      receiver = undefined;
    }
  });

  test('receiving packed message (Message type)', function(done) {
    var mockedReceiver = nodemock
          .mock('start')
          .mock('receive')
            .takes({ message: true });

    receiver = new FluentReceiver();
    receiver.on('droonga.message', function(data) {
      mockedReceiver.receive(data);
    });
    receiver.listen(function() {
      mockedReceiver.start();
    });

    Deferred
      .wait(0.01)
      .next(function() {
        assert.notEqual(receiver.port, undefined);

        var rawPacket = ['droonga.message', Date.now(), { message: true }];
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

  test('receiving packed message (Forward type)', function(done) {
    var mockedReceiver = nodemock
          .mock('start')
          .mock('receive')
            .takes({ message1: true })
          .mock('receive')
            .takes({ message2: true });

    receiver = new FluentReceiver();
    receiver.on('droonga.message', function(data) {
      mockedReceiver.receive(data);
    });
    receiver.listen(function() {
      mockedReceiver.start();
    });

    Deferred
      .wait(0.01)
      .next(function() {
        assert.notEqual(receiver.port, undefined);

        var rawPacket = ['droonga.message', [[Date.now(), { message1: true }],
                                             [Date.now(), { message2: true }]]];
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

    receiver = new FluentReceiver();
    receiver.on('droonga.message', function(data) {
      mockedReceiver.receive(data);
    });
    receiver.listen(function() {
      mockedReceiver.start();
    });

    Deferred
      .wait(0.01)
      .next(function() {
        assert.notEqual(receiver.port, undefined);

        var rawPacket = ['droonga.message', Date.now(), { message1: true }];
        return utils.sendPacketTo(rawPacket, receiver.port);
      })
      .next(function() {
        var rawPacket = ['droonga.message', Date.now(), { message2: true }];
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

