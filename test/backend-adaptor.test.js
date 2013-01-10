var assert = require('chai').assert;
var nodemock = require('nodemock');

var Connection = require('../lib/backend-adaptor').Connection;

function createMockedSender() {
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

function createMockedReceiver() {
  var mockedSockets;
  var mockedReceiverInternal = nodemock;
  var connactionCallbackController = {};
  var messageCallbackController = {};
  var receiver = {
    // mocking receiver
    sockets:
      (mockedSockets = nodemock.mock('on')
         .takes('connection', function() {})
         .ctrl(1, connactionCallbackController)),
    'set': function(key, value) {},

    // extra features as a mocked object
    triggerConnect: function(tag) {
      mockedSockets.assertThrows();
      var mockedSocket = nodemock.mock('on')
                           .takes(tag + '.message', function() {})
                           .ctrl(1, messageCallbackController);
      connactionCallbackController.trigger(mockedSocket);
      mockedSocket.assertThrows();
    },
    emitMessage: function(message) { // simulate message from backend
      messageCallbackController.trigger(message);
    }
  };
  return receiver;
}

function createMockedMessageCallback() {
  var mockedCallback = nodemock;
  var callback = function(message) {
    mockedCallback.receive(message);
  };
  callback.takes = function(message) {
    callback.assert = function() {
      mockedCallback.assertThrows();
    };
    mockedCallback = mockedCallback
                       .mock('receive')
                       .takes(message);
  };
  callback.mock = mockedCallback;
  return callback;
}

function TypeOf(typeString) {
  if (!(this instanceof TypeOf))
    return new TypeOf(typeString);

  this.typeString = typeString;
  if (typeString == 'date') {
    return new InstanceOf(Date);
  }
}

function InstanceOf(constructor) {
  if (!(this instanceof InstanceOf))
    return new InstanceOf(constructor);

  this.constructorFunction = constructor;
}

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

suite('Connection', function() {
  var connection;
  var sender;
  var receiver;

  setup(function() {
    connection = new Connection({
      tag:        'test',
      listenPort: 3333,
      sender:     sender = createMockedSender(),
      receiver:   receiver = createMockedReceiver()
    });
    receiver.triggerConnect('test');
  });

  teardown(function() {
    connection = undefined;
    sender = undefined;
    receiver = undefined;
  });

  test('sending message without response (volatile message)', function() {
    var message = connection.emitMessage({ command: 'foobar' });
    assertEnvelopeEqual(message,
                        { id:         TypeOf('string'),
                          date:       InstanceOf(Date),
                          statusCode: 200,
                          body:       { command: 'foobar' } });
    sender.assertSent('message', message);
  });

  test('receiving message from the backend', function() {
    var callback = createMockedMessageCallback();
    connection.on('message', callback);

    var now = new Date();
    var message = {
      id:         now.getTime(),
      date:       now.toISOString(),
      statusCode: 200,
      body:       'first call'
    };
    callback.takes(message);
    receiver.emitMessage(message);
    callback.assert();

    message.body = 'second call';
    callback.takes(message);
    receiver.emitMessage(message);
    callback.assert();

    message.body = 'third call';
    connection.removeListener('message', callback);
    receiver.emitMessage(message);
    callback.assert();
  });

  test('sending message with one response', function() {
    var callback = createMockedMessageCallback();
    var message = connection.emitMessage({ command: 'foobar' }, callback);
    assertEnvelopeEqual(message,
                        { id:         TypeOf('string'),
                          date:       InstanceOf(Date),
                          statusCode: 200,
                          body:       { command: 'foobar' } });
    sender.assertSent('message', message);

    var now = new Date();
    var response = {
      id:         now.getTime(),
      date:       now.toISOString(),
      replyTo:    message.id,
      statusCode: 200,
      body:       'first call'
    };
    callback.takes(response);
    receiver.emitMessage(response);
    callback.assert();

    // Secondary and later messages are ignored.
    response.body = 'second call';
    receiver.emitMessage(response);
    callback.assert();
  });
});

