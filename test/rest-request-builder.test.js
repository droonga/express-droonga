var assert = require('chai').assert;

var utils = require('./test-utils');

var builders = require('../lib/adapter/api/rest-request-builder');

suite('building message from REST adapter request', function() {
  suite('search', function() {
    test('simple query', function() {
      var fakeRequest = {
        params: {
          tableName: 'test_table'
        },
        query: {
          query: 'foobar'
        }
      };
      var expectedBody = {
        queries: {
          'testTables': {
            source: 'test_table',
            condition: {
              query:  'foobar'
            },
            output: {
              elements: utils.allElements,
              attributes: []
            }
          }
        }
      };
      var actualBody = builders.search(fakeRequest);
      assert.equalJSON(actualBody, expectedBody);
    });

    test('with options', function() {
      var fakeRequest = {
        params: {
          tableName: 'people'
        },
        query: {
          query:      'foobar',
          offset:     '10',
          limit:      '100',
          match_to:   'realname,nickname',
          sort_by:    '-realname,-nickname',
          attributes: 'realname,nickname,age,job',
          timeout:    '1000'
        }
      };
      var expectedBody = {
        timeout: 1000,
        queries: {
          people: {
            source:  'people',
            condition: {
              query:   'foobar',
              matchTo: ['realname', 'nickname'],
            },
            sortBy:  ['-realname', '-nickname'],
            output: {
              attributes: ['realname', 'nickname', 'age', 'job'],
              elements: utils.allElements,
              limit:   100,
              offset:  10,
            }
          }
        }
      };
      var actualBody = builders.search(fakeRequest);
      assert.equalJSON(actualBody, expectedBody);
    });

    suite('validation', function() {
      function deepClone(base) {
        if (!base || typeof base != 'object')
          return base;

        var cloned = Object.create(null);
        Object.keys(base).forEach(function(key) {
          cloned[key] = deepClone(base[key]);
        });
        return cloned;
      }

      function merge(base, extra) {
        if (!extra || typeof extra != 'object')
          return base || extra;

        var merged = deepClone(base);
        Object.keys(extra).forEach(function(key) {
          merged[key] = merge(merged[key], extra[key]);
        });
        return merged;
      }

      function testSuccessFor(request, baseRequest) {
        request = merge(baseRequest, request);
        test(JSON.stringify(request) + ' (success)', function() {
          assert.doesNotThrow(function() {
            builders.search(request);
          });
        });
      }

      function testFailFor(request, errorMessage, baseRequest) {
        request = merge(baseRequest, request);
        test(JSON.stringify(request) + ' (fail)', function() {
          assert.throws(function() {
            builders.search(request);
          }, errorMessage);
        });
      }

      var baseRequest = {
        params: {},
        query: {}
      };

      testSuccessFor({ params: { tableName: 'foobar' } }, baseRequest);
      testFailFor({}, 'no source', baseRequest);
      testFailFor({ params: { tableName: '' } }, 'no source', baseRequest);

      baseRequest.params.tableName = 'test';

      testSuccessFor({ query: { limit: '0' } }, baseRequest);
      testSuccessFor({ query: { limit: '10' } }, baseRequest);
      testSuccessFor({ query: { limit: '-10' } }, baseRequest);
      testFailFor({ query: { limit: '' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { limit: '0.1' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { limit: '-0.1' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { limit: 'foobar' } }, 'invalid integer', baseRequest);

      testSuccessFor({ query: { offset: '0' } }, baseRequest);
      testSuccessFor({ query: { offset: '10' } }, baseRequest);
      testSuccessFor({ query: { offset: '-10' } }, baseRequest);
      testFailFor({ query: { offset: '' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { offset: '0.1' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { offset: '-0.1' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { offset: 'foobar' } }, 'invalid integer', baseRequest);

      testSuccessFor({ query: { timeout: '0' } }, baseRequest);
      testSuccessFor({ query: { timeout: '10' } }, baseRequest);
      testSuccessFor({ query: { timeout: '-10' } }, baseRequest);
      testFailFor({ query: { timeout: '' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { timeout: '0.1' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { timeout: '-0.1' } }, 'invalid integer', baseRequest);
      testFailFor({ query: { timeout: 'foobar' } }, 'invalid integer', baseRequest);
    });
  });
});

