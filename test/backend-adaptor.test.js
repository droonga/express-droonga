var assert = require('chai').assert;
var nodemock = require('nodemock');

var Connection = require('../lib/backend-adaptor').Connection;

function createSender() {
  var sender = {
    emit: function(eventName, message) {
      this.messages.push({ eventName: eventName, message: message });
    },
    assertSent: function(eventName, message) {
      var firstMessage = this.messages.shift();
      var expectedMessage = { eventName: eventName, message: message };
      assert.deepEqual(firstMessage, expectedMessage);
    },
    messages: [],
  };
  return sender;
}

function createReceiver() {
  var mockedSockets;
  var mockedReceiverInternal = nodemock;
  var connactionCallbackController = {};
  var receiver = {
    // mocking receiver
    sockets:
      (mockedSockets = nodemock.mock('on')
         .takes('connection', function() {})
         .ctrl(1, connactionCallbackController)),
    'set': function(key, value) {},

    // extra features as a mocked object
    triggerConnect: function(tag) {
      mockedSockets.assert();
      var mockedSocket = nodemock.mock('on')
                           .takes(tag + '.message', function() {});
      connactionCallbackController.trigger(mockedSocket);
      mockedSocket.assert();
    },
    takes: function(message) {
      this.assert = function() {
        mockedReceiverInternal.assert();
      };
      mockedReceiverInternal = mockedReceiverInternal
                                 .mock('emit')
                                 .takes(message);
      return mockedReceiverInternal;
    }
  };
  return receiver;
}

suite('Connection', function() {
  var connection;
  var sender;
  var receiver;

  setup(function() {
    connection = new Connection({
      tag:        'test',
      listenPort: 3333,
      sender:     sender = createSender(),
      receiver:   receiver = createReceiver()
    });
    receiver.triggerConnect('test');
  });

  teardown(function() {
    connection = undefined;
    sender = undefined;
    receiver = undefined;
  });

  test('message without response (volatile message)', function() {
    connection.emitMessage({ command: 'foobar' });
    sender.assertSent('message', { body: { command: 'foobar' } });
  });
});

