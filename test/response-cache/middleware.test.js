var client = require('supertest');
var express = require('express');

var assert = require('chai').assert;

var middleware = require('../../lib/response-cache');

suite('Response Cache Middleware', function() {
  var application;
  setup(function() {
    application = express();
    application.use(middleware({
      rules: [
        { regex: /cached/ }
      ]
    }));
    application.get('/cached/success', function(request, response){
      response.send(200, 'OK');
    });
    application.get('/cached/fail', function(request, response){
      response.send(400, 'NG');
    });
    application.get('/fresh', function(request, response){
      response.send(200, 'OK');
    });
    application.listen(3000, '0.0.0.0');
  });

  test('cached', function(done) {
    client(application)
      .get('/cached/success')
      .expect(200)
      .end(function(error, response){
        if (error)
          return done(error);

        client(application)
          .get('/cached/success')
          .expect(200)
          .expect('X-Droonga-Cached', 'yes')
          .end(function(error, response){
            if (error)
              done(error);
            else
              done();
          });
      });
  });
});

