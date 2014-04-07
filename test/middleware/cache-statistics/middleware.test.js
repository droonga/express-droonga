var client = require('supertest');
var express = require('express');

var assert = require('chai').assert;

var Cache = require('../../../lib/cache');
var middleware = require('../../../lib/middleware/cache-statistics');

suite('middleware - cache statistics -', function() {
  var application;
  var cache;
  setup(function() {
    cache = new Cache();
    application = express();
    application.use('/cache/statistics', middleware(cache));
  });

  test('json', function(done) {
    client(application)
      .get('/cache/statistics')
      .expect(200)
      .end(function(error, response) {
        if (error)
          return done(error);

        var statistics = {
          nGets: 0,
          nHits: 0,
          hitRatio: 0.0
        };
        try {
          assert.deepEqual(response.body, statistics);
        } catch (error) {
          return done(error);
        }
        done();
      });
  });
});
