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

    var now = new Date();
    var message = {
      id:         now.getTime(),
      date:       now.toISOString(),
      statusCode: 200,
      type:       'testResponse',
      body:       'first call'
    };
    callback.takes(message);
    var packet = ['test.message', Date.now(), message];
    utils.sendPacketTo(packet, utils.testReceivePort)
      .next(function() {
        callback.assert();

        message.body = 'second call';
        callback.takes(message);
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .next(function() {
        callback.assert();

        message.body = 'third call';
        connection.removeListener('message', callback);
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .next(function() {
        callback.assert();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging, success', function(done) {
    var callback = createMockedMessageCallback();
    var response;
    var packet;
    var message = connection.emitMessage('testRequest',
                                         { command: 'foobar' },
                                         callback);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest',
                                                { command: 'foobar' }));
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 1, 'message should be sent');
        assert.deepEqual(backend.received[0][2], message);

        response = createReplyEnvelopeFor(message,
                                          'testResponse',
                                          'first call');
        callback.takes(null, response);
        packet = ['test.message', Date.now(), response];
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .wait(0.01)
      .next(function() {
        callback.assert();

        // Secondary and later messages are ignored.
        response.body = 'second call';
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .wait(0.01)
      .next(function() {
        callback.assert();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging, error', function(done) {
    var callback = createMockedMessageCallback();
    var response;
    var packet;
    var message = connection.emitMessage('testRequest',
                                         { command: 'foobar' },
                                         callback);
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest',
                                                { command: 'foobar' }));
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 1, 'message should be sent');
        assert.deepEqual(backend.received[0][2], message);

        response = createReplyEnvelopeFor(message,
                                          'testResponse',
                                          'first call');
        response.statusCode = 503;
        callback.takes(503, response);
        packet = ['test.message', Date.now(), response];
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .wait(0.01)
      .next(function() {
        callback.assert();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging, timeout (not timed out)', function(done) {
    var callback = createMockedMessageCallback();
    var response;
    var packet;
    var message = connection.emitMessage('testRequest',
                                         { command: 'foobar' },
                                         callback,
                                         { timeout: 1000 });
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest',
                                                { command: 'foobar' }));
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 1, 'message should be sent');
        assert.deepEqual(backend.received[0][2], message);
        assert.equal(connection.listeners('reply:' + message.id).length,
                     1,
                     'response listener should be still there');

        response = createReplyEnvelopeFor(message,
                                          'testResponse',
                                          'first call');
        callback.takes(null, response);
        packet = ['test.message', Date.now(), response];
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .wait(0.01)
      .next(function() {
        callback.assert();
        assert.equal(connection.listeners('reply:' + message.id).length,
                     0,
                     'response listener should be removed');
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging, timeout (timed out)', function(done) {
    var callback = createMockedMessageCallback();
    var response;
    callback.takes(Connection.ERROR_GATEWAY_TIMEOUT, null);
    var message = connection.emitMessage('testRequest',
                                         { command: 'foobar' },
                                         callback,
                                         { timeout: 20 });
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest',
                                                { command: 'foobar' }));
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 1, 'message should be sent');
        assert.deepEqual(backend.received[0][2], message);
        assert.equal(connection.listeners('reply:' + message.id).length,
                     1,
                     'response listener should be still there');
      })
      .wait(0.02)
      .next(function() {
        assert.equal(connection.listeners('reply:' + message.id).length,
                     0,
                     'response listener should be removed by timeout');
        callback.assert();
        done();
      })
      .error(function(error) {
        done(error);
      });
  });

  test('request-response style messaging, timeout (ignored negative timeout)', function() {
    var callback = createMockedMessageCallback();
    var response;
    var packet;
    var message = connection.emitMessage('testRequest',
                                         { command: 'foobar' },
                                         callback,
                                         { timeout: -1 });
    assert.envelopeEqual(message,
                         createExpectedEnvelope('testRequest',
                                                { command: 'foobar' }));
    Deferred
      .wait(0.01)
      .next(function() {
        assert.equal(backend.received.length, 1, 'message should be sent');
        assert.deepEqual(backend.received[0][2], message);
        assert.equal(connection.listeners('reply:' + message.id).length,
                     1,
                     'response listener should be still there');

        response = createReplyEnvelopeFor(message, 'testResponse', 'first call');
        callback.takes(null, response);
        packet = ['test.message', Date.now(), message];
        return utils.sendPacketTo(packet, utils.testReceivePort);
      })
      .wait(0.01)
      .next(function() {
        callback.assert();
        assert.equal(connection.listeners('reply:' + message.id).length,
                     0),
                     'response listener should be removed';
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
