var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');
var TypeOf = utils.TypeOf;
var InstanceOf = utils.InstanceOf;

var backendAdaptor = require('../lib/backend-adaptor');
var Connection = backendAdaptor.Connection;

suite('Connection', function() {
  var connection;
  var sender;
  var receiver;

  setup(function() {
    connection = new Connection({
      tag:        'test',
      receiveHostName: 'localhost',
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

  function createExpectedEnvelope(type, body) {
    return {
      id:         TypeOf('string'),
      date:       InstanceOf(Date),
      replyTo:    'localhost:' + utils.testReceivePort,
      statusCode: 200,
      type:       type,
      body:       body
    };
  }

  function createReplyEnvelopeFor(message, type, body) {
    var now = new Date();
    var response = {
      id:         now.getTime(),
      date:       now.toISOString(),
      inReplyTo:  message.id,
      statusCode: 200,
      type:       type,
      body:       body
    };
    return response;
  }

  test('sending message without response (volatile message)', function() {
    var message = connection.emitMessage('testRequest', { command: 'foobar' });
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest', { command: 'foobar' }));
    sender.assertSent('message', message);
  });

  function createMockedMessageCallback() {
    var mockedCallback = nodemock;
    var callback = function() {
      mockedCallback.receive.apply(mockedCallback, arguments);
    };
    callback.takes = function() {
      callback.assert = function() {
        mockedCallback.assertThrows();
      };
      mockedCallback = mockedCallback.mock('receive');
      mockedCallback = mockedCallback.takes.apply(mockedCallback, arguments);
    };
    callback.mock = mockedCallback;
    return callback;
  }

  test('receiving message from the backend', function() {
    var callback = createMockedMessageCallback();
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

  test('sending message with one response, success', function() {
    var callback = createMockedMessageCallback();
    var message = connection.emitMessage('testRequest', { command: 'foobar' }, callback);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest', { command: 'foobar' }));
    sender.assertSent('message', message);

    var response = createReplyEnvelopeFor(message, 'testResponse', 'first call');
    callback.takes(null, response);
    receiver.emitMessage(response);
    callback.assert();

    // Secondary and later messages are ignored.
    response.body = 'second call';
    receiver.emitMessage(response);
    callback.assert();
  });

  test('sending message with one response, with error', function() {
    var callback = createMockedMessageCallback();
    var message = connection.emitMessage('testRequest', { command: 'foobar' }, callback);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest', { command: 'foobar' }));
    sender.assertSent('message', message);

    var response = createReplyEnvelopeFor(message, 'testResponse', 'first call');
    response.statusCode = 503;
    callback.takes(503, response);
    receiver.emitMessage(response);
    callback.assert();
  });

  test('sending message with one response, timeout (not timed out)', function() {
    var callback = createMockedMessageCallback();
    var message = connection.emitMessage('testRequest', { command: 'foobar' }, callback, 1000);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest', { command: 'foobar' }));
    sender.assertSent('message', message);
    assert.equal(connection.listeners('inReplyTo:' + message.id).length, 1);

    var response = createReplyEnvelopeFor(message, 'testResponse', 'first call');
    callback.takes(null, response);
    receiver.emitMessage(response);
    callback.assert();
    assert.equal(connection.listeners('inReplyTo:' + message.id).length, 0);
  });

  test('sending message with one response, timeout (timed out)', function(done) {
    var callback = createMockedMessageCallback();
    var message = connection.emitMessage('testRequest', { command: 'foobar' }, callback, 1);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest', { command: 'foobar' }));
    sender.assertSent('message', message);
    assert.equal(connection.listeners('inReplyTo:' + message.id).length, 1);

    callback.takes(backendAdaptor.ERROR_GATEWAY_TIMEOUT, null);
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(connection.listeners('inReplyTo:' + message.id).length, 0);
        callback.assert();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('sending message with one response, timeout (ignored negative timeout)', function() {
    var callback = createMockedMessageCallback();
    var message = connection.emitMessage('testRequest', { command: 'foobar' }, callback, -1);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest', { command: 'foobar' }));
    sender.assertSent('message', message);
    assert.equal(connection.listeners('inReplyTo:' + message.id).length, 1);

    var response = createReplyEnvelopeFor(message, 'testResponse', 'first call');
    callback.takes(null, response);
    Deferred
      .wait(0.01)
      .next(function() {
        receiver.emitMessage(response);
        callback.assert();
        assert.equal(connection.listeners('inReplyTo:' + message.id).length, 0);
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

