var assert = require('chai').assert;
var nodemock = require('nodemock');

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
exports.createMockedSender = createMockedSender;

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
exports.createMockedReceiver = createMockedReceiver;

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
exports.createMockedMessageCallback = createMockedMessageCallback;


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
