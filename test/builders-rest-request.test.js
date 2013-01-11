var assert = require('chai').assert;

var builders = require('../lib/builders/rest-request');

suite('from search REST API', function() {
  test('simple query', function() {
    var params = {
      tableName: 'test_table',
      query:     'foobar'
    };
    var expectedBody = {
      queries: {
        result: {
          source: 'test_table',
          query:  'foobar',
          output: {
            startTime:   true,
            elapsedTime: true,
            count:       true,
            attributes:  true,
            recodes:     true
          }
        }
      }
    };
    var actualBody = builders.search({ params: params });
    assert.deepEqual(actualBody, expectedBody);
  });
});

