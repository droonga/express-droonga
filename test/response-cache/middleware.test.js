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
    application.post('/cached/post', function(request, response){
      response.send(200, 'OK');
    });
  });

  function assertNotCached(response, done) {
    try {
      assert.equal(-1, Object.keys(response.headers).indexOf('X-Droonga-Cached'.toLowerCase()));
      if (done)
        done();
    } catch(error) {
      if (done)
        done(error);
      else
        throw error;
    }
  }

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

  suite('not cached', function() {
  test('initial access', function(done) {
    client(application)
      .get('/cached/success')
      .expect(200)
      .end(function(error, response){
        if (error)
          return done(error);
        else
          assertNotCached(response, done);
      });
  });

  test('error response', function(done) {
    client(application)
      .get('/cached/fail')
      .expect(400)
      .end(function(error, response){
        if (error)
          return done(error);

        client(application)
          .get('/cached/fail')
          .expect(400)
          .end(function(error, response){
            if (error)
              done(error);
            else
              assertNotCached(response, done);
          });
      });
  });

  test('not matched', function(done) {
    client(application)
      .get('/fresh')
      .expect(200)
      .end(function(error, response){
        if (error)
          return done(error);

        client(application)
          .get('/fresh')
          .expect(200)
          .end(function(error, response){
            if (error)
              done(error);
            else
              assertNotCached(response, done);
          });
      });
  });

  test('not GET method', function(done) {
    client(application)
      .post('/cached/post')
      .send('OK')
      .expect(200)
      .end(function(error, response){
        if (error)
          return done(error);

        client(application)
          .post('/cached/post')
          .send('OK')
          .expect(200)
          .end(function(error, response){
            if (error)
              done(error);
            else
              assertNotCached(response, done);
          });
      });
  });
  });
});

