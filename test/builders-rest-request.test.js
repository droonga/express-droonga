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
  });
});

