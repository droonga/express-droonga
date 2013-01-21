var assert = require('chai').assert;

var utils = require('./test-utils');
var TypeOf = utils.TypeOf;
var InstanceOf = utils.InstanceOf;

var Connection = require('../lib/backend-adaptor').Connection;

suite('Connection', function() {
  var connection;
  var sender;
  var receiver;

  setup(function() {
    connection = new Connection({
      tag:        'test',
      receivePort: utils.testReceivePort,
      sender:     sender = utils.createMockedSender(),
      receiver:   receiver = utils.createMockedReceiver()
    });
    receiver.triggerConnect('test');
  });

  teardown(function() {
    connection = undefined;
    sender = undefined;
    receiver = undefined;
  });

  test('sending message without response (volatile message)', function() {
    var message = connection.emitMessage('testRequest', { command: 'foobar' });
    assert.envelopeEqual(message,
                         { id:         TypeOf('string'),
                           date:       InstanceOf(Date),
                           replyTo:    'localhost:' + utils.testReceivePort,
                           statusCode: 200,
                           type:       'testRequest',
                           body:       { command: 'foobar' } });
    sender.assertSent('message', message);
  });

  test('receiving message from the backend', function() {
    var callback = utils.createMockedMessageCallback();
    connection.on('message', callback);

    var now = new Date();
    var message = {
      id:         now.getTime(),
      date:       now.toISOString(),
      statusCode: 200,
      type:       'testResponse',
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
    var callback = utils.createMockedMessageCallback();
    var message = connection.emitMessage('testRequest', { command: 'foobar' }, callback);
    assert.envelopeEqual(message,
                         { id:         TypeOf('string'),
                           date:       InstanceOf(Date),
                           replyTo:    'localhost:' + utils.testReceivePort,
                           statusCode: 200,
                           type:       'testRequest',
                           body:       { command: 'foobar' } });
    sender.assertSent('message', message);

    var now = new Date();
    var response = {
      id:         now.getTime(),
      date:       now.toISOString(),
      inReplyTo:  message.id,
      statusCode: 200,
      type:       'testResponse',
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

