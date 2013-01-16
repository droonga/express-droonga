var assert = require('chai').assert;

var utils = require('./test-utils');

var builders = require('../lib/builders/rest-request');

suite('building message from REST API request', function() {
  suite('search', function() {
    var outputAll = {
      startTime:   true,
      elapsedTime: true,
      count:       true,
      attributes:  true,
      recodes:     true
    };

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
            output: outputAll
          }
        }
      };
      var actualBody = builders.search({ params: params });
      assert.equalJSON(actualBody, expectedBody);
    });

    test('with options', function() {
      var params = {
        tableName:  'people',
        query:      'foobar',
        offset:     '10',
        limit:      '100',
        match_to:   'realname,nickname',
        sort_by:    '-realname,-nickname',
        attributes: 'realname,nickname,age,job'
      };
      var expectedBody = {
        queries: {
          result: {
            source:  'people',
            query:   'foobar',
            offset:  10,
            limit:   100,
            matchTo: ['realname', 'nickname'],
            sortBy:  ['-realname', '-nickname'],
            attributes: ['realname', 'nickname', 'age', 'job'],
            output:  outputAll
          }
        }
      };
      var actualBody = builders.search({ params: params });
      assert.equalJSON(actualBody, expectedBody);
    });

    suite('validation', function() {
      function testSuccessFor(key, value, params) {
        test(key + '=' + value + '(success)', function() {
          assert.doesNotThrow(function() {
            params = Object.create(params || {});
            params[key] = value;
            builders.search({ params: params });
          });
        });
      }

      function testFailFor(key, value, params, errorMessage) {
        test(key + '=' + value + '(fail)', function() {
          assert.throws(function() {
            params = Object.create(params || {});
            params[key] = value;
            builders.search({ params: params });
          }, errorMessage);
        });
      }

      var baseParams = { tableName: 'test' };

      testSuccessFor('tableName', 'foobar');
      testFailFor('', '', null, 'no source');
      testFailFor('tableName', '', null, 'no source');

      testSuccessFor('limit', '0', baseParams);
      testSuccessFor('limit', '10', baseParams);
      testSuccessFor('limit', '-10', baseParams);
      testFailFor('limit', '', baseParams, 'invalid integer');
      testFailFor('limit', '0.1', baseParams, 'invalid integer');
      testFailFor('limit', '-0.1', baseParams, 'invalid integer');
      testFailFor('limit', 'foobar', baseParams, 'invalid integer');

      testSuccessFor('offset', '0', baseParams);
      testSuccessFor('offset', '10', baseParams);
      testSuccessFor('offset', '-10', baseParams);
      testFailFor('offset', '', baseParams, 'invalid integer');
      testFailFor('offset', '0.1', baseParams, 'invalid integer');
      testFailFor('offset', '-0.1', baseParams, 'invalid integer');
      testFailFor('offset', 'foobar', baseParams, 'invalid integer');
    });
  });
});

