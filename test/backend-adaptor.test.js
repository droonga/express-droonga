var assert = require('chai').assert;
var nodemock = require('nodemock');

var Connection = require('../lib/backend-adaptor').Connection;

function createSender() {
  return nodemock;
}

function createReceiver() {
  var mockedSocket = nodemock;
  var callbackController = {};
  var receiver = {
    // mocking receiver
    sockets:
      (mockedSocket =
        mockedSocket.mock('on')
          .takes('test.message', function() {})
          .ctrl(1, callbackController)),
    'set': function(key, value) {},

    // extra features as a mocked object
    triggerMessage: function(message) {
      callbackController.trigger(message);
    },
    mock: function(name) {
      return mockedSocket.mock(name);
    },
    assert: function() {
      mockedSocket.assert();
    }
  };
  return receiver;
}

suit('Connection', function() {
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
  });

  teardown(function() {
    connection = undefined;
    sender = undefined;
    receiver = undefined;
  });

  function assertMessages() {
    sender.assert();
    receiver.assert();
  }

  test('message without response (volatile message)', function() {
    sender.mock('emit')
      .takes({ tag: 'message',
               message: { command: 'foobar' } });
    connection.emit({ command: 'foobar' });
    assertMessages();
  });
});

