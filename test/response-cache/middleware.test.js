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
  });

  test('cached', function(done) {
    application.get('/cached/success', function(request, response) {
      response.send(200, 'OK');
    });
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

  test('handler skipped', function(done) {
    var handled = false;
    application.get('/cached/handled', function(request, response){
      handled = true;
      response.send(200, 'OK');
    });
    client(application)
      .get('/cached/handled')
      .expect(200)
      .end(function(error, response){
        if (error)
          return done(error);

        try {
          assert.isTrue(handled);
        } catch(error) {
          return done(error);
        }
        handled = false;

        client(application)
          .get('/cached/handled')
          .expect(200)
          .end(function(error, response){
            if (error)
              return done(error);

            try {
              assert.isFalse(handled);
            } catch(error) {
              return done(error);
            }
            done();
          });
      });
  });

  test('cached headers', function(done) {
    application.get('/cached/headers', function(request, response){
      response.setHeader('X-Custom-Header', 'yes');
      response.send(200, 'OK');
    });
    client(application)
      .get('/cached/headers')
      .expect(200)
      .end(function(error, response){
        if (error)
          return done(error);

        client(application)
          .get('/cached/headers')
          .expect(200)
          .expect('X-Droonga-Cached', 'yes')
          .end(function(error, response){
            if (error)
              return done(error);
            done();
          });
      });
  });

  test('cached body', function(done) {
    application.get('/cached/body', function(request, response){
      response.json(200, { value: true });
    });
    client(application)
      .get('/cached/body')
      .expect(200, { value: true })
      .end(function(error, response){
        if (error)
          return done(error);

        client(application)
          .get('/cached/body')
          .expect(200, { value: true })
          .end(function(error, response){
            if (error)
              return done(error);
            done();
          });
      });
  });

  suite('not cached', function() {
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

    test('initial access', function(done) {
      application.get('/cached/initial', function(request, response) {
        response.send(200, 'OK');
      });
      client(application)
        .get('/cached/initial')
        .expect(200)
        .end(function(error, response){
          if (error)
            return done(error);
          else
            assertNotCached(response, done);
        });
    });

    test('error response', function(done) {
      application.get('/cached/fail', function(request, response) {
        response.send(400, 'NG');
      });
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
      application.get('/fresh', function(request, response) {
        response.send(200, 'OK');
      });
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
      application.post('/cached/post', function(request, response) {
        response.send(200, 'OK');
      });
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

