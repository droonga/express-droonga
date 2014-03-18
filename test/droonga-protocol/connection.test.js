var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../test-utils');
var TypeOf = utils.TypeOf;
var InstanceOf = utils.InstanceOf;

var Connection = require('../../lib/droonga-protocol/connection').Connection;

suite('Connection', function() {
  suite('initialization', function() {
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

  suite('simple communication', function() {
    var connection;
    var backend;

    function setupEnvironment(done) {
      utils.createBackend()
        .next(function(newBackend) {
          backend = newBackend;
          connection = new Connection({
            tag:      'test',
            defaultDataset: 'test-dataset',
            hostName: 'localhost',
            port:     utils.testSendPort,
            receivePort: utils.testReceivePort,
            maxRetyrCount: 3,
            retryDelay: 1
          });
          done();
        });
    }

    function teardownEnvironment() {
      if (backend) {
        backend.close();
        backend = undefined;
      }
      if (connection) {
        connection.close();
        connection = undefined;
      }
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

    function getBackendReceivedMessages() {
      return backend.received.map(function(packet) {
        return packet[2];
      });
    }

    suite('one way message', function() {
      setup(setupEnvironment);
      teardown(teardownEnvironment);

      test('from front to back, without callback', function(done) {
        var objectMessage = connection.emitMessage('object', { command: 'foobar' });
        assert.envelopeEqual(objectMessage,
                             utils.createExpectedEnvelope('object',
                                                          { command: 'foobar' }));

        var stringMessage = connection.emitMessage('string', 'string');
        assert.envelopeEqual(stringMessage,
                             utils.createExpectedEnvelope('string', 'string'));

        var numericMessage = connection.emitMessage('numeric', 1234);
        assert.envelopeEqual(numericMessage,
                             utils.createExpectedEnvelope('numeric', 1234));

        var messageForAnotherDataset = connection.emitMessage('message',
                                                              'another',
                                                              { dataset: 'another' });
        assert.envelopeEqual(messageForAnotherDataset,
                             utils.createExpectedEnvelope('message',
                                                          'another',
                                                          { dataset: 'another' }));

        Deferred
          .wait(0.01)
          .next(function() {
            assert.deepEqual(getBackendReceivedMessages(),
                             [objectMessage,
                              stringMessage,
                              numericMessage,
                              messageForAnotherDataset]);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('from front to back, with callback', function(done) {
        var callback = function() {};

        var objectMessage = connection.emitMessage('object', { command: 'foobar' }, callback);
        assert.envelopeEqual(objectMessage,
                             utils.createExpectedEnvelope('object',
                                                          { command: 'foobar' },
                                                          { requireReply: true }));

        var stringMessage = connection.emitMessage('string', 'string', callback);
        assert.envelopeEqual(stringMessage,
                             utils.createExpectedEnvelope('string',
                                                          'string',
                                                          { requireReply: true }));

        var numericMessage = connection.emitMessage('numeric', 1234, callback);
        assert.envelopeEqual(numericMessage,
                             utils.createExpectedEnvelope('numeric',
                                                          1234,
                                                          { requireReply: true }));

        var messageForAnotherDataset = connection.emitMessage('message',
                                                              'another',
                                                              callback,
                                                              { dataset: 'another' });
        assert.envelopeEqual(messageForAnotherDataset,
                             utils.createExpectedEnvelope('message',
                                                          'another',
                                                          { dataset: 'another',
                                                            requireReply: true }));

        Deferred
          .wait(0.01)
          .next(function() {
            assert.deepEqual(getBackendReceivedMessages(),
                             [objectMessage,
                              stringMessage,
                              numericMessage,
                              messageForAnotherDataset]);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('from back to front', function(done) {
        var callback = createMockedMessageCallback();
        connection.on('string', callback);
        connection.on('numeric', callback);
        connection.on('object', callback);
        connection.on('unknown, ignored', callback);

        var stringMessage = utils.createEnvelope('string', 'string');
        var numericMessage = utils.createEnvelope('numeric', 1234);
        var objectMessage = utils.createEnvelope('object', { value: true });
        callback
          .takes(stringMessage)
          .takes(numericMessage)
          .takes(objectMessage);

        utils
          .sendPacketTo(utils.createPacket(stringMessage), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(numericMessage), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(objectMessage), utils.testReceivePort)
          .sendPacketTo(utils.createPacket({}, 'unknown, ignored'), utils.testReceivePort)
          .next(function() {
            callback.assert();
            done();
          })
          .error(function(error) {
            done(error);
          });
      });
    });

    suite('request-response', function() {
      setup(setupEnvironment);
      teardown(teardownEnvironment);

      test('success', function(done) {
        var callback = createMockedMessageCallback();

        // this event should not be emitted, because it is supressed by reply:* event
        connection.on('result', callback);

        var messages = [
          connection.emitMessage('event', Math.random(), callback),
          connection.emitMessage('event', Math.random(), callback)
        ];
        var responses = [
          utils.createReplyEnvelope(messages[0], 'result', Math.random()),
          utils.createReplyEnvelope(messages[1], 'result', Math.random())
        ];
        callback
          .takes(null, responses[0])
          .takes(null, responses[1]);
        Deferred
          .wait(0.01)
          .next(function() {
            assert.deepEqual(getBackendReceivedMessages(), messages);
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [1,1],
              'response listeners should be registered'
            );
          })
          .sendPacketTo(utils.createPacket(responses[0]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[1]), utils.testReceivePort)
          .wait(0.01)
          .next(function() {
            callback.assert();
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [0,0],
              'response listeners should be removed'
            );
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('error', function(done) {
        var callback = createMockedMessageCallback();

        // this event should not be emitted, because it is supressed by reply:* event
        connection.on('result', callback);

        var messages = [
          connection.emitMessage('event', Math.random(), callback),
          connection.emitMessage('event', Math.random(), callback)
        ];
        var responses = [
          utils.createReplyEnvelope(messages[0], 'result', Math.random()),
          utils.createReplyEnvelope(messages[1], 'result', Math.random())
        ];
        // make them error responses
        responses[0].statusCode = 502;
        responses[1].statusCode = 503;
        callback
          .takes(responses[0].statusCode, responses[0])
          .takes(responses[1].statusCode, responses[1]);
        Deferred
          .wait(0.01)
          .next(function() {
            assert.deepEqual(getBackendReceivedMessages(), messages);
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [1,1],
              'response listeners should be registered'
            );
          })
          .sendPacketTo(utils.createPacket(responses[0]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[1]), utils.testReceivePort)
          .wait(0.01)
          .next(function() {
            callback.assert();
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [0,0],
              'response listeners should be removed'
            );
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('duplicated', function(done) {
        var callback = createMockedMessageCallback();

        // this event should not be emitted, because it is supressed by reply:* event
        connection.on('result', callback);

        var messages = [
          connection.emitMessage('event', Math.random(), callback),
          connection.emitMessage('event', Math.random(), callback)
        ];
        var responses = [
          utils.createReplyEnvelope(messages[0], 'result', Math.random()),
          utils.createReplyEnvelope(messages[1], 'result', Math.random()),
          utils.createReplyEnvelope(messages[0], 'result', 'duplicated, ignored'),
          utils.createReplyEnvelope(messages[1], 'result', 'duplicated, ignored')
        ];
        responses[1].statusCode = 503;
        callback
          .takes(null, responses[0])
          .takes(responses[1].statusCode, responses[1]);
        Deferred
          .wait(0.01)
          .next(function() {
            assert.deepEqual(getBackendReceivedMessages(), messages);
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [1,1],
              'response listeners should be registered'
            );
          })
          .sendPacketTo(utils.createPacket(responses[0]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[1]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[2]), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses[3]), utils.testReceivePort)
          .wait(0.01)
          .next(function() {
            callback.assert();
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [0,0],
              'response listeners should be removed'
            );
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('timeout', function(done) {
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
            utils.createReplyEnvelope(messages.notTimedOut, 'ok', Math.random()),
          timedOut:
            utils.createReplyEnvelope(messages.timedOut, 'ignored', Math.random())
        };
        callback
          .takes(Connection.ERROR_GATEWAY_TIMEOUT, null)
          .takes(null, responses.notTimedOut)
        Deferred
          .wait(0.01)
          .next(function() {
            assert.deepEqual(getBackendReceivedMessages(),
                             [messages.notTimedOut,
                              messages.timedOut,
                              messages.permanent]);
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
          .sendPacketTo(utils.createPacket(responses.notTimedOut), utils.testReceivePort)
          .sendPacketTo(utils.createPacket(responses.timedOut), utils.testReceivePort)
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
  });

  suite('to backend', function() {
    var connection;
    var backend;
    var restartedBackend;

    setup(function(done) {
      restartedBackend = undefined;
      utils.createBackend()
        .next(function(newBackend) {
          backend = newBackend;
          connection = new Connection({
            tag:      utils.testTag,
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
      if (restartedBackend) {
        restartedBackend.close();
        restartedBackend = undefined;
      }
      if (connection) {
        connection.close();
        connection = undefined;
      }
    });

    test('normal messaging', function(done) {
      var deferred = new Deferred();
      connection.emitMessage('type', { message: true });
      backend.once('receive', function() {
        deferred.call();
      });
      deferred
        .next(function() {
          assert.deepEqual(backend.getEvents(),
                           ['type']);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });

    test('disconnected suddenly', function(done) {
      Deferred
        .next(function() {
          var deferred = new Deferred();
          connection.emitMessage('type1', { message: true });
          backend.once('receive', function() {
            deferred.call();
          });
          return deferred;
        })
        .next(function() {
          assert.deepEqual(backend.getEvents(),
                           ['type1']);
          var deferred = new Deferred();
          backend.close(function() {
            deferred.call();
          });
          return deferred;
        })
        .next(function() {
          var deferred = new Deferred();

          connection.on('error', function(error) {
            deferred.call();
          });

          connection.emitMessage('type2', { message: true });

          return deferred;
        })
        .createBackend()
        .next(function(newBackend) {
          restartedBackend = newBackend;
          assert.deepEqual(backend.getEvents(),
                           ['type1']);
          assert.deepEqual(restartedBackend.getEvents(),
                           []);

          connection.emitMessage('type3', { message: true });

          var deferred = new Deferred();
          restartedBackend.once('receive', function() {
            restartedBackend.once('receive', function() {
              deferred.call();
            });
          });
          return deferred;
        })
        .next(function() {
          assert.deepEqual(backend.getEvents(),
                           ['type1']);
          assert.deepEqual(restartedBackend.getEvents(),
                           ['type2', 'type3']);
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });
});
