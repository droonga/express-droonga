var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('./test-utils');
var TypeOf = utils.TypeOf;
var InstanceOf = utils.InstanceOf;

var Connection = require('../lib/backend/connection').Connection;
var FluentReceiver = require('../lib/backend/receiver').FluentReceiver;

function createBackend() {
  var deferred = new Deferred();
  var backend = new FluentReceiver(utils.testSendPort);
  backend.received = [];
  backend.on('receive', function(data) {
    backend.received.push(data);
  });
  backend.listen(function() {
    return deferred.call(backend);
  });
  return deferred;
}

suite('Connection, initialization', function() {
  var connection;

  teardown(function() {
    if (connection) {
      connection.close();
      connection = undefined;
    }
  });

  function assertEventEmitter(object) {
    assert.equal(typeof object,
                 'object',
                 'should be an instance of EventEmitter');
    assert.equal(typeof object.emit,
                 'function',
                 'should be an instance of EventEmitter');
  }

  test('sender', function() {
    connection = new Connection({ tag: 'test' });
    assertEventEmitter(connection._sender);
  });

  test('receiver', function(done) {
    connection = new Connection({ tag: 'test' });
    assertEventEmitter(connection._receiver);
    assert.equal(connection.receivePort,
                 undefined,
                 'should be not-initialized');

    Deferred
      .wait(0.01)
      .next(function() {
        assert.notEqual(connection.receivePort,
                        undefined,
                        'should be initialized');
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

suite('Connection, simple communication', function() {
  var connection;
  var backend;

  setup(function(done) {
    createBackend()
      .next(function(newBackend) {
        backend = newBackend;
        connection = new Connection({
          tag:      'test',
          hostName: 'localhost',
          port:     utils.testSendPort,
          receivePort: utils.testReceivePort,
          maxRetyrCount: 3,
          retryDelay: 1
        });
        done();
      });
  });

  teardown(function() {
    if (backend) {
      backend.close();
      backend = undefined;
    }
    if (connection) {
      connection.close();
      connection = undefined;
    }
  });

  function createEnvelope(type, body) {
    var now = new Date();
    var envelope = {
      id:         now.getTime(),
      date:       now.toISOString(),
      replyTo:    'localhost:' + utils.testReceivePort,
      statusCode: 200,
      type:       type,
      body:       body
    };
    return envelope;
  }

  function createExpectedEnvelope(type, body) {
    var envelope = createEnvelope(type, body);
    envelope.id = TypeOf('string');
    envelope.date = InstanceOf(Date);
    return envelope;
  }

  function createReplyEnvelopeFor(message, type, body) {
    var response = createEnvelope(type, body);
    response.inReplyTo = message.id;
    return response;
  }

  function createPacket(message, tag) {
    tag = tag || 'test.message';
    return [tag, Date.now(), message];
  }

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
      return this;
    };
    callback.mock = mockedCallback;
    return callback;
  }

  test('one way message from front to back', function(done) {
    var objectMessage = connection.emitMessage('object', { command: 'foobar' });
    assert.envelopeEqual(objectMessage,
                         createExpectedEnvelope('object',
                                                { command: 'foobar' }));

    var stringMessage = connection.emitMessage('string', 'string');
    assert.envelopeEqual(stringMessage,
                         createExpectedEnvelope('string', 'string'));

    var numericMessage = connection.emitMessage('numeric', 1234);
    assert.envelopeEqual(numericMessage,
                         createExpectedEnvelope('numeric', 1234));

    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 3, 'messages should be sent');
        assert.deepEqual([backend.received[0][2],
                          backend.received[1][2],
                          backend.received[2][2]],
                         [objectMessage,
                          stringMessage,
                          numericMessage]);
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('one way message from back to front', function(done) {
    var callback = createMockedMessageCallback();
    connection.on('message', callback);

    var stringMessage = createEnvelope('string', 'string');
    var numericMessage = createEnvelope('numeric', 1234);
    var objectMessage = createEnvelope('object', { value: true });
    callback
      .takes(stringMessage)
      .takes(numericMessage)
      .takes(objectMessage);

    utils
      .sendPacketTo(createPacket(stringMessage), utils.testReceivePort)
      .sendPacketTo(createPacket(numericMessage), utils.testReceivePort)
      .sendPacketTo(createPacket(objectMessage), utils.testReceivePort)
      .sendPacketTo(createPacket({}, 'unknown, ignored'), utils.testReceivePort)
      .next(function() {
        callback.assert();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging', function(done) {
    var callback = createMockedMessageCallback();
    var messages = [
      connection.emitMessage('first request', Math.random(), callback),
      connection.emitMessage('second request', Math.random(), callback),
      connection.emitMessage('third request', Math.random(), callback)
    ];
    var responses = [
      createReplyEnvelopeFor(messages[1], 'second response', Math.random()),
      createReplyEnvelopeFor(messages[0], 'first response', Math.random()),
      createReplyEnvelopeFor(messages[2], 'third response', Math.random()),
      createReplyEnvelopeFor(messages[0], 'duplicated, ignored', 0),
      createReplyEnvelopeFor(messages[1], 'duplicated, ignored', 0),
      createReplyEnvelopeFor(messages[2], 'duplicated, ignored', 0)
    ];
    responses[2].statusCode = 503; // make it as an error response
    callback
      .takes(null, responses[0])
      .takes(null, responses[1])
      .takes(responses[2].statusCode, responses[2]);
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 3, 'message should be sent');
        assert.deepEqual(
          [connection.listeners('reply:' + messages[0].id).length,
           connection.listeners('reply:' + messages[1].id).length,
           connection.listeners('reply:' + messages[2].id).length],
          [1,1,1],
          'response listeners should be registered'
        );
      })
      .sendPacketTo(createPacket(responses[0]), utils.testReceivePort)
      .sendPacketTo(createPacket(responses[1]), utils.testReceivePort)
      .sendPacketTo(createPacket(responses[2]), utils.testReceivePort)
      .sendPacketTo(createPacket(responses[3]), utils.testReceivePort)
      .sendPacketTo(createPacket(responses[4]), utils.testReceivePort)
      .sendPacketTo(createPacket(responses[5]), utils.testReceivePort)
      .wait(0.01)
      .next(function() {
        callback.assert();
        assert.deepEqual(
          [connection.listeners('reply:' + messages[0].id).length,
           connection.listeners('reply:' + messages[1].id).length,
           connection.listeners('reply:' + messages[2].id).length],
          [0,0,0],
          'response listeners should be removed'
        );
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging, timeout', function(done) {
    var callback = createMockedMessageCallback();
    var response;
    var packet;
    var messages = {
      notTimedOut:
        connection.emitMessage('not timed out',
                               Math.random(),
                               callback,
                               { timeout: 1000 }),
      timedOut:
        connection.emitMessage('timed out',
                               Math.random(),
                               callback,
                               { timeout: 20 }),
      permanent:
        connection.emitMessage('permanent',
                               Math.random(),
                               callback,
                               { timeout: -1 })
    };
    var responses = {
      notTimedOut:
        createReplyEnvelopeFor(messages.notTimedOut, 'ok', Math.random()),
      timedOut:
        createReplyEnvelopeFor(messages.timedOut, 'ignored', Math.random())
    ];
    callback
      .takes(Connection.ERROR_GATEWAY_TIMEOUT, null)
      .takes(null, responses.notTimedOut)
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 3, 'message should be sent');
        assert.deepEqual(
          { notTimedOut:
              connection.listeners('reply:' + messages.notTimedOut.id).length,
            timedOut:
              connection.listeners('reply:' + messages.timedOut.id).length,
            permanent:
              connection.listeners('reply:' + messages.permanent.id).length },
          { notTimedOut: 1, timedOut: 1, permanent: 1 },
          'response listeners should be registered'
        );
      })
      .wait(0.02)
      .sendPacketTo(responses.notTimedOut, utils.testReceivePort)
      .sendPacketTo(responses.timedOut, utils.testReceivePort)
      .wait(0.01)
      .next(function() {
        callback.assert();
        assert.deepEqual(
          { notTimedOut:
              connection.listeners('reply:' + messages.notTimedOut.id).length,
            timedOut:
              connection.listeners('reply:' + messages.timedOut.id).length,
            permanent:
              connection.listeners('reply:' + messages.permanent.id).length },
          { notTimedOut: 0, timedOut: 0, permanent: 1 },
          'response listener should be removed even if it is timed out'
        );
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});

suite('Connection, to backend', function() {
  var connection;
  var backend;

  setup(function(done) {
    createBackend()
      .next(function(newBackend) {
        backend = newBackend;
        connection = new Connection({
          tag:      'test',
          hostName: 'localhost',
          port:     utils.testSendPort,
          maxRetyrCount: 3,
          retryDelay: 1
        });
        done();
      });
  });

  teardown(function() {
    if (backend) {
      backend.close();
      backend = undefined;
    }
    if (connection) {
      connection.close();
      connection = undefined;
    }
  });

  test('normal messaging', function(done) {
    connection.emitMessage({ message: true });
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length,
                     1,
                     'message should be sent: ' + JSON.stringify(backend.received));
        assert.equal(backend.received[0][0], 'test.message');
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('disconnected suddenly', function(done) {
    var errorHandler;
    var restartedBackend;
    connection.emitMessage('test', { message: true });
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length,
                     1,
                     'message should be sent: ' + JSON.stringify(backend.received));
        assert.equal(backend.received[0][0], 'test.message');

        backend.close();
      })
      .wait(0.01)
      .next(function() {
        return createBackend();
      })
      .next(function(newBackend) {
        restartedBackend = newBackend;

        errorHandler = nodemock
          .mock('handle')
            .takes({});
        connection.on('error', function(error) {
          errorHandler.handle(error);
        });

        connection.emitMessage('test', { message: true });
      })
      .wait(0.1)
      .next(function() {
        errorHandler.assertThrows();
        assert.equal(backend.received.length,
                     1,
                     'no new message should be sent to the old backend' + JSON.stringify(backend.received));
        assert.equal(restartedBackend.received.length,
                     0,
                     'message should be destroyed by socket error' + JSON.stringify(restartedBackend.received));

        connection.emitMessage('test', { message: true });
      })
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length,
                     1,
                     'no new message should be sent to the old backend' + JSON.stringify(backend.received));
        assert.equal(restartedBackend.received.length,
                     1,
                     'message should be sent to the new backend' + JSON.stringify(restartedBackend.received));
        done();
      })
      .error(function(error) {
        done(error);
      });
  });
});
