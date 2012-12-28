var assert = require('chai').assert;
var nodemock = require('nodemock');

var Connection = require('../lib/backend-adaptor').Connection;

suit('Connection', function() {
  var connection;
  var sender;

  setup(function() {
    sender = {
      emittedMessages: [];
      emit: function(tag, message) {
        this.emittedMessages.push({ tag: tag, message: message });
      }
    };
    connection = new Connection({
      tag: 'test',
      host: 'localhost',
      port: 3000,
      sender: sender
    });
  });

  teardown(function() {
    connection = undefined;
    sender = undefined;
  });

  test('message without response (volatile message)', function() {
    connection.emit({ command: 'foobar' });
    assert.deepEqual(sender.emittedMessages,
                     [{ tag: 'message',
                        message: { command: 'foobar' } }]);
  });
});

