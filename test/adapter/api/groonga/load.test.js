var assert = require('chai').assert;
var nodemock = require('nodemock');
var client = require('supertest');

var utils = require('../../../test-utils');
var groongaUtils = require('./utils');

var express = require('express');
var httpAdapter = require('../../../../lib/adapter/http');
var groongaAPI = require('../../../../lib/adapter/api/groonga');

suite('adapter/api/groonga: load', function() {
  var connectionPool;
  var application;
  var server;
  var backend;

  var successMessage = groongaUtils.successMessage;

  setup(function(done) {
    utils.setupApplication()
      .then(function(result) {
        backend = result.backend;
        server = result.server;
        connectionPool = result.connectionPool;
        application = result.application;
        httpAdapter.register(application, {
          prefix: '',
          connectionPool: connectionPool,
          plugins: [groongaAPI]
        });
        done();
      })
      .catch(done);
  });

  teardown(function() {
    utils.teardownApplication({
      backend:    backend,
      server:     server,
      connectionPool: connectionPool
    });
  });

  suite('success', function() {
    suite('URL suffix', function() {
      test('nothing', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        client(application)
          .post('/d/load?table=Users')
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end(function(error, response) {
            if (error)
              return done(error);
            done();
          });
      });

      test('.json', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        client(application)
          .post('/d/load.json?table=Users')
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end(function(error, response) {
            if (error)
              return done(error);
            done();
          });
      });
    });

    suite('HTTP header', function() {
      test('status code', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        client(application)
          .post('/d/load?table=Users')
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end(function(error, response) {
            if (error)
              return done(error);
            done();
          });
      });
    });

    suite('n records', function() {
      test('zero', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        client(application)
          .post('/d/load?table=Users')
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end(function(error, response) {
            if (error)
              return done(error);
            try {
              var responseBody = groongaUtils.groongaResponseBody(response);
              assert.deepEqual(responseBody, [0]);
            } catch(error) {
              return done(error);
            }
            done();
          });
      });

      test('one', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
          {
            _key: 'alice'
          }
        ]
        client(application)
          .post('/d/load?table=Users')
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end(function(error, response) {
            if (error)
              return done(error);
            try {
              var responseBody = groongaUtils.groongaResponseBody(response);
              assert.deepEqual(responseBody, [1]);
            } catch(error) {
              return done(error);
            }
            done();
          });
      });

      test('multiple', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        groongaUtils.pushSuccessResponse(backend);
        var body = [
          {
            _key: 'alice'
          },
          {
            _key: 'bob'
          }
        ]
        client(application)
          .post('/d/load?table=Users')
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end(function(error, response) {
            if (error)
              return done(error);
            try {
              var responseBody = groongaUtils.groongaResponseBody(response);
              assert.deepEqual(responseBody, [2]);
            } catch(error) {
              return done(error);
            }
            done();
          });
      });
    });

    suite('POST', function() {
      function post(body, additionalQuery) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var path = {
          pathname: '/d/load',
          query: {
            table: 'Memos'
          }
        };
        if (additionalQuery) {
          Object.keys(additionalQuery).forEach(function(key) {
            path.query[key] = additionalQuery[key];
          });
        }

        return utils.post(path, JSON.stringify(body))
          .then(function(request) {
            return requestBody;
          });
      }

      suite('object style', function() {
        test('no _key', function(done) {
          var body = [
            {
              title: 'Droonga',
              content: 'Droonga is fun!'
            }
          ]
          post(body)
            .then(function(requestBody) {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Memos',
                                 values: {
                                   title: 'Droonga',
                                   content: 'Droonga is fun!'
                                 }
                               });
              done();
            })
            .catch(done);
        });

        test('with columns', function(done) {
          var body = [
            {
              _key: 'alice',
              title: 'Alice',
              content: 'Alice is ...'
            }
          ]
          post(body)
            .then(function(requestBody) {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Memos',
                                 key: 'alice',
                                 values: {
                                   title: 'Alice',
                                   content: 'Alice is ...'
                                 }
                               });
              done();
            })
            .catch(done);
        });
      });

      suite('array style', function() {
        test('no _key', function(done) {
          var body = [
            [
              'title',
              'content'
            ],
            [
              'Droonga',
              'Droonga is fun!'
            ]
          ]
          post(body)
            .then(function(requestBody) {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Memos',
                                 values: {
                                   title: 'Droonga',
                                   content: 'Droonga is fun!'
                                 }
                               });
              done();
            })
            .catch(done);
        });

        test('with columns', function(done) {
          var body = [
            [
              '_key',
              'title',
              'content'
            ],
            [
              'alice',
              'Alice',
              'Alice is ...'
            ]
          ]
          post(body)
            .then(function(requestBody) {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Memos',
                                 key: 'alice',
                                 values: {
                                   title: 'Alice',
                                   content: 'Alice is ...'
                                 }
                               });
              done();
            })
            .catch(done);
        });

        test('with columns query parameter', function(done) {
          var query = {
            columns: '_key,title,content'
          }
          var body = [
            [
              'alice',
              'Alice',
              'Alice is ...'
            ]
          ]
          post(body, query)
            .then(function(requestBody) {
              assert.deepEqual(requestBody,
                               {
                                 table: 'Memos',
                                 key: 'alice',
                                 values: {
                                   title: 'Alice',
                                   content: 'Alice is ...'
                                 }
                               });
              done();
            })
            .catch(done);
        });
      });
    });

    suite('GET', function() {
      function get(values) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });

        var path = {
          pathname: '/d/load',
          query: {
            table: 'Users',
            values: JSON.stringify(values)
          }
        };

        return utils.get(path)
          .then(function(response) {
            return requestBody;
          });
      };

      test('object style', function(done) {
        var values = [
          {
            _key: 'alice',
            name: 'Alice',
            age: 20
          }
        ];
        get(values)
          .then(function(requestBody) {
            assert.deepEqual(requestBody,
                             {
                               table: 'Users',
                               key: 'alice',
                               values: {
                                 name: 'Alice',
                                 age: 20
                               }
                             });
            done();
          })
          .catch(done);
      });

      test('array style', function(done) {
        var values = [
          [
            '_key',
            'name',
            'age'
          ],
          [
            'alice',
            'Alice',
            20
          ]
        ];
        get(values)
          .then(function(requestBody) {
            assert.deepEqual(requestBody,
                             {
                               table: 'Users',
                               key: 'alice',
                               values: {
                                 name: 'Alice',
                                 age: 20
                               }
                             });
            done();
          })
          .catch(done);
      });
    });
  });

  suite('failure', function() {
    test('no table', function(done) {
      var body = [
        {
          _key: 'alice'
        }
      ];
      client(application)
        .post('/d/load')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400)
        .end(function(error, response) {
          if (error)
            return done(error);
          try {
            var actual = {
              groongaStatusCode: groongaUtils.groongaResponseHeader(response)[0],
              errorMessage: groongaUtils.groongaResponseHeader(response)[3],
              body: groongaUtils.groongaResponseBody(response)
            }
            assert.deepEqual(actual,
                             {
                               groongaStatusCode: -22,
                               errorMessage: 'required parameter is missing: <table>',
                               body: [0]
                             });
          } catch(error) {
            return done(error);
          }
          done();
        });
    });
  });
});
