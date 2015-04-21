var assert = require('chai').assert;
var nodemock = require('nodemock');

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

      utils.wait(0.01)
        .then(function() {
          assert.notEqual(connection.receivePort,
                          undefined,
                          'should be initialized');
          done();
        })
        .catch(done);
    });
  });

  suite('simple communication', function() {
    var connection;
    var backend;

    function setupEnvironment(done) {
      utils.createBackend()
        .then(function(newBackend) {
          backend = newBackend;
          connection = new Connection({
            tag:      'test',
            defaultDataset: 'test-dataset',
            hostName: '127.0.0.1',
            port:     utils.testSendPort,
            receivePort: utils.testReceivePort,
            maxRetyrCount: 3,
            retryDelay: 1
          });
          done();
        })
        .catch(done);
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

        utils.wait(0.01)
          .then(function() {
            assert.deepEqual(getBackendReceivedMessages(),
                             [objectMessage,
                              stringMessage,
                              numericMessage,
                              messageForAnotherDataset]);
            done();
          })
          .catch(done)
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

        utils.wait(0.01)
          .then(function() {
            assert.deepEqual(getBackendReceivedMessages(),
                             [objectMessage,
                              stringMessage,
                              numericMessage,
                              messageForAnotherDataset]);
            done();
          })
          .catch(done);
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

        utils.wait(0)
          .then(utils.sendPacketToCb(utils.createPacket(stringMessage), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(numericMessage), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(objectMessage), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket({}, 'unknown, ignored'), utils.testReceivePort))
          .then(function() {
            callback.assert();
            done();
          })
          .catch(done);
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
        utils.wait(0.01)
          .then(function() {
            assert.deepEqual(getBackendReceivedMessages(), messages);
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [1,1],
              'response listeners should be registered'
            );
          })
          .then(utils.sendPacketToCb(utils.createPacket(responses[0]), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(responses[1]), utils.testReceivePort))
          .then(utils.waitCb(0.01))
          .then(function() {
            callback.assert();
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [0,0],
              'response listeners should be removed'
            );
            done();
          })
          .catch(done);
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
        utils.wait(0.01)
          .then(function() {
            assert.deepEqual(getBackendReceivedMessages(), messages);
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [1,1],
              'response listeners should be registered'
            );
          })
          .then(utils.sendPacketToCb(utils.createPacket(responses[0]), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(responses[1]), utils.testReceivePort))
          .then(utils.waitCb(0.01))
          .then(function() {
            callback.assert();
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [0,0],
              'response listeners should be removed'
            );
            done();
          })
          .catch(done);
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
        utils.wait(0.01)
          .then(function() {
            assert.deepEqual(getBackendReceivedMessages(), messages);
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [1,1],
              'response listeners should be registered'
            );
          })
          .then(utils.sendPacketToCb(utils.createPacket(responses[0]), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(responses[1]), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(responses[2]), utils.testReceivePort))
          .then(utils.sendPacketToCb(utils.createPacket(responses[3]), utils.testReceivePort))
          .then(utils.waitCb(0.01))
          .then(function() {
            callback.assert();
            assert.deepEqual(
              [connection.listeners('reply:' + messages[0].id).length,
               connection.listeners('reply:' + messages[1].id).length],
              [0,0],
              'response listeners should be removed'
            );
            done();
          })
          .catch(done);
      });

      suite('timeout', function() {
        test('not timed out', function(done) {
          var callback = createMockedMessageCallback();
          var response;
          var packet;
          var message = connection.emitMessage('not timed out',
                                               Math.random(),
                                               callback,
                                               { timeout: 1000 });
          var response = utils.createReplyEnvelope(message, 'ok', Math.random());
          callback.takes(null, response);

          utils.wait(0.01)
            .then(function() {
              assert.deepEqual(getBackendReceivedMessages(),
                               [message]);
              assert.equal(
                connection.listeners('reply:' + message.id).length,
                1,
                'response listeners should be registered'
              );
            })
            .then(utils.waitCb(0.02))
            .then(utils.sendPacketToCb(utils.createPacket(response), utils.testReceivePort))
            .then(utils.waitCb(0.01))
            .then(function() {
              assert.equal(
                connection.listeners('reply:' + message.id).length,
                0,
                'response listener should be removed even if it is timed out'
              );
              connection.close();
              callback.assert();
              done();
            })
            .catch(done);
        });

        test('timed out', function(done) {
          var callback = createMockedMessageCallback();
          var response;
          var packet;
          var message = connection.emitMessage('timed out',
                                               Math.random(),
                                               callback,
                                               { timeout: 20 });
          callback.takes(Connection.ERROR_GATEWAY_TIMEOUT, null);

          utils.wait(0.01)
            .then(function() {
              assert.deepEqual(getBackendReceivedMessages(),
                               [message]);
              assert.equal(
                connection.listeners('reply:' + message.id).length,
                1,
                'response listeners should be registered'
              );
            })
            .then(utils.waitCb(0.03))
            .then(function() {
              assert.equal(
                connection.listeners('reply:' + message.id).length,
                0,
                'response listener should be removed even if it is timed out'
              );
              connection.close();
              callback.assert();
              done();
            })
            .catch(done);
        });

        test('permanent callback (never timed out)', function(done) {
          var callback = createMockedMessageCallback();
          var response;
          var packet;
          var message = connection.emitMessage('permanent',
                                               Math.random(),
                                               callback,
                                               { timeout: -1 });
          // connection closed before response message is returned
          callback.takes(Connection.ERROR_SERVICE_UNAVAILABLE, null);

          utils.wait(0.01)
            .then(function() {
              assert.deepEqual(getBackendReceivedMessages(),
                               [message]);
              assert.equal(
                connection.listeners('reply:' + message.id).length,
                1,
                'response listeners should be registered'
              );
            })
            .then(utils.waitCb(0.03))
            .then(function() {
              assert.equal(
                connection.listeners('reply:' + message.id).length,
                1,
                'response listener should not be removed'
              );
              connection.close();
              callback.assert();
              done();
            })
            .catch(done);
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
        .then(function(newBackend) {
          backend = newBackend;
          connection = new Connection({
            tag:      utils.testTag,
            hostName: '127.0.0.1',
            port:     utils.testSendPort,
            maxRetyrCount: 3,
            retryDelay: 1
          });
          done();
        })
        .catch(done);
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
      function trigger() {
        connection.emitMessage('type', { message: true });
      }
      backend.thenableOnce('receive')
        .then(function() {
          assert.deepEqual(backend.getEvents(),
                           ['type']);
          done();
        })
        .catch(done);

      trigger();
    });

    test('disconnected suddenly', function(done) {
      function trigger() {
        connection.emitMessage('type1', { message: true });
      }

      var lastError = null;
      backend.thenableOnce('receive')
        .then(function() {
          assert.deepEqual(backend.getEvents(),
                           ['type1']);
          return backend.thenableClose();
        })
        .then(function() {
          return connection.thenableEmitMessage('type2', { message: true })
            .then(function(args) {
              lastError = args.response.body.detail;
            });
        })
        .then(function() {
          assert.isNotNull(lastError);
          assert.equal(lastError.code, 'ECONNREFUSED');
        })
        .then(utils.createBackendCb())
        .then(function(newBackend) {
          restartedBackend = newBackend;
          assert.deepEqual(backend.getEvents(),
                           ['type1']);
          assert.deepEqual(restartedBackend.getEvents(),
                           []);

          connection.emitMessage('type3', { message: true });

          return utils.wait(0.1);
        })
        .then(function() {
          assert.deepEqual(backend.getEvents(),
                           ['type1']);
          assert.deepEqual(restartedBackend.getEvents(),
                           ['type2', 'type3']);
          done();
        })
        .catch(done);

      trigger();
    });
  });
});
