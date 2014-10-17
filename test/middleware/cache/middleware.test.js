var client = require('supertest');
var express = require('express');

var assert = require('chai').assert;

var Cache = require('../../../lib/cache');
var middleware = require('../../../lib/middleware/cache');

suite('middleware - cache -', function() {
  var application;
  var cache;
  setup(function() {
    cache = new Cache();
    application = express();
    application.use(middleware(cache, {
      rules: [
        { regex: /cached/ }
      ]
    }));
  });

  suite('required parameters', function() {
    test('missing rules', function() {
      assert.throw(function() {
        middleware(cache, {
        });
      }, Error);
    });

    test('not-array rules', function() {
      assert.throw(function() {
        middleware(cache, {
          rules: {
            'foo' : {
              ttl: 10
            }
          }
        });
      }, Error);
    });
  });

  suite('findRule -', function() {
    suite('a rule -', function() {
      setup(function() {
        application = express();
        application.use(middleware(cache, {
          rules: [
            { regex: /^\/cache-target\// }
          ]
        }));
      });

      test('non-GET requests', function(done) {
        application.post('/cache-target/path', function(request, response) {
          response.status(200).send('POST - success');
        });
        client(application)
          .post('/cache-target/path')
          .end(function(error, response) {
            if (error)
              return done(error);

            var nGets = cache.getStatistics().nGets;
            try {
              assert.deepEqual(nGets, 0);
            } catch (error) {
              return done(error);
            }
            done();
          });
      });

      test('not matched', function(done) {
        application.get('/not-cache-target/path', function(request, response) {
          response.status(200).send('GET - success');
        });
        client(application)
          .get('/not-cache-target/path')
          .end(function(error, response) {
            if (error)
              return done(error);

            var nGets = cache.getStatistics().nGets;
            try {
              assert.deepEqual(nGets, 0);
            } catch (error) {
              return done(error);
            }
            done();
          });
      });

      test('matched to a rule', function(done) {
        application.get('/cache-target/path', function(request, response) {
          response.status(200).send('GET - success');
        });
        client(application)
          .get('/cache-target/path')
          .end(function(error, response) {
            if (error)
              return done(error);

            var nGets = cache.getStatistics().nGets;
            try {
              assert.deepEqual(nGets, 1);
            } catch (error) {
              return done(error);
            }
            done();
          });
      });
    });

    suite('multiple rules', function() {
      setup(function() {
        application = express();
      });

      test('matched to multiple rules', function(done) {
        var notUsedTtlInMilliSeconds = 1;
        application.use(middleware(cache, {
          rules: [
            {
              regex: /^\/cache-target/,
              ttlInMilliSeconds: 1000
            },
            {
              regex: /^\/cache-target-not-used/,
              ttlInMilliSeconds: notUsedTtlInMilliSeconds
            }
          ]
        }));
        application.get('/cache-target-not-used', function(request, response) {
          response.status(200).send('GET - success');
        });

        client(application)
          .get('/cache-target-not-used')
          .end(function(error, response) {
            if (error)
              return done(error);

            setTimeout(function() {
              client(application)
                .get('/cache-target-not-used')
                .expect(200)
                .expect('X-Droonga-Cached', 'yes')
                .end(function(error, response) {
                  if (error)
                    return done(error);
                  done();
                });
            }, notUsedTtlInMilliSeconds + 1);
          });
      });
    });
  });

  test('cached', function(done) {
    application.get('/cached/success', function(request, response) {
      response.status(200).send('OK');
    });
    client(application)
      .get('/cached/success')
      .expect(200)
      .end(function(error, response) {
        if (error)
          return done(error);

        client(application)
          .get('/cached/success')
          .expect(200)
          .expect('X-Droonga-Cached', 'yes')
          .end(function(error, response) {
            if (error)
              done(error);
            else
              done();
          });
      });
  });

  test('handler skipped', function(done) {
    var handled = false;
    application.get('/cached/handled', function(request, response) {
      handled = true;
      response.status(200).send('OK');
    });
    client(application)
      .get('/cached/handled')
      .expect(200)
      .end(function(error, response) {
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
          .end(function(error, response) {
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
    application.get('/cached/headers', function(request, response) {
      response.setHeader('X-Custom-Header', 'yes');
      response.status(200).send('OK');
    });
    client(application)
      .get('/cached/headers')
      .expect(200)
      .end(function(error, response) {
        if (error)
          return done(error);

        client(application)
          .get('/cached/headers')
          .expect(200)
          .expect('X-Droonga-Cached', 'yes')
          .end(function(error, response) {
            if (error)
              return done(error);
            done();
          });
      });
  });

  test('cached body', function(done) {
    application.get('/cached/body', function(request, response) {
      response.status(200).json({ value: true });
    });
    client(application)
      .get('/cached/body')
      .expect(200, { value: true })
      .end(function(error, response) {
        if (error)
          return done(error);

        client(application)
          .get('/cached/body')
          .expect(200, { value: true })
          .end(function(error, response) {
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
        response.status(200).send('OK');
      });
      client(application)
        .get('/cached/initial')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);
          else
            assertNotCached(response, done);
        });
    });

    test('error response', function(done) {
      application.get('/cached/fail', function(request, response) {
        response.status(400).send('NG');
      });
      client(application)
        .get('/cached/fail')
        .expect(400)
        .end(function(error, response) {
          if (error)
            return done(error);

          client(application)
            .get('/cached/fail')
            .expect(400)
            .end(function(error, response) {
              if (error)
                done(error);
              else
                assertNotCached(response, done);
            });
        });
    });

    test('not matched', function(done) {
      application.get('/fresh', function(request, response) {
        response.status(200).send('OK');
      });
      client(application)
        .get('/fresh')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          client(application)
            .get('/fresh')
            .expect(200)
            .end(function(error, response) {
              if (error)
                done(error);
              else
                assertNotCached(response, done);
            });
        });
    });

    test('not GET method', function(done) {
      application.post('/cached/post', function(request, response) {
        response.status(200).send('OK');
      });
      client(application)
        .post('/cached/post')
        .send('OK')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          client(application)
            .post('/cached/post')
            .send('OK')
            .expect(200)
            .end(function(error, response) {
              if (error)
                done(error);
              else
                assertNotCached(response, done);
            });
        });
    });

    test('size over', function(done) {
      application = express();
      cache = new Cache({
        size: 1,
      });
      application.use(middleware(cache, {
        rules: [
          { regex: /cached/ }
        ]
      }));
      application.get('/cached/first', function(request, response) {
        response.status(200).json('OK');
      });
      application.get('/cached/second', function(request, response) {
        response.status(200).json('OK');
      });
      client(application)
        .get('/cached/first')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          client(application)
            .get('/cached/second')
            .expect(200)
            .end(function(error, response) {
              if (error)
                return done(error);

              client(application)
                .get('/cached/second')
                .expect(200)
                .expect('X-Droonga-Cached', 'yes')
                .end(function(error, response) {
                  if (error)
                    return done(error);

                  client(application)
                    .get('/cached/first')
                    .expect(200)
                    .end(function(error, response) {
                      if (error)
                        done(error);
                      else
                        assertNotCached(response, done);
                    });
                });
            });
        });
    });

    test('expired by global TTL', function(done) {
      application = express();
      application.use(middleware(cache, {
        ttlInMilliSeconds: 10,
        rules: [
          { regex: /cached/ }
        ]
      }));
      application.get('/cached/expired', function(request, response) {
        response.status(200).json('OK');
      });
      client(application)
        .get('/cached/expired')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          setTimeout(function() {
            client(application)
              .get('/cached/expired')
              .expect(200)
              .end(function(error, response) {
                if (error)
                  return done(error);
                else
                  assertNotCached(response, done);
              });
          }, 50);
        });
    });

    test('expired by TTL for a rule', function(done) {
      application = express();
      application.use(middleware(cache, {
        rules: [
          { regex: /cached/, ttlInMilliSeconds: 10 }
        ]
      }));
      application.get('/cached/expired', function(request, response) {
        response.status(200).json('OK');
      });
      client(application)
        .get('/cached/expired')
        .expect(200)
        .end(function(error, response) {
          if (error)
            return done(error);

          setTimeout(function() {
            client(application)
              .get('/cached/expired')
              .expect(200)
              .end(function(error, response) {
                if (error)
                  return done(error);
                else
                  assertNotCached(response, done);
              });
          }, 50);
        });
    });
  });
});

