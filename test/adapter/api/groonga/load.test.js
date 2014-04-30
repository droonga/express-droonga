var assert = require('chai').assert;
var nodemock = require('nodemock');
var Deferred = require('jsdeferred').Deferred;

var utils = require('../../../test-utils');
var groongaUtils = require('./utils');

var express = require('express');
var httpAdapter = require('../../../../lib/adapter/http');
var groongaAPI = require('../../../../lib/adapter/api/groonga');

suite('adapter/api/groonga: load', function() {
  var connection;
  var application;
  var server;
  var backend;

  var successMessage = groongaUtils.successMessage;

  setup(function(done) {
    utils.setupApplication()
      .next(function(result) {
        backend = result.backend;
        server = result.server;
        connection = result.connection;
        application = result.application;
        httpAdapter.register(application, {
          prefix: '',
          connection: connection,
          plugins: [groongaAPI]
        });
        done();
      });
  });

  teardown(function() {
    utils.teardownApplication({
      backend:    backend,
      server:     server,
      connection: connection
    });
  });

  suite('success', function() {
    suite('URL suffix', function() {
      test('nothing', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            assert.deepEqual(response.statusCode, 200);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('.json', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        utils.post('/d/load.json?table=Users', JSON.stringify(body))
          .next(function(response) {
            assert.deepEqual(response.statusCode, 200);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });
    });

    suite('HTTP header', function() {
      test('status code', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            assert.deepEqual(response.statusCode, 200);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });
    });

    suite('n records', function() {
      test('zero', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            var responseBody = groongaUtils.groongaResponseBody(response);
            assert.deepEqual(responseBody, [0]);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });

      test('one', function(done) {
        groongaUtils.pushSuccessResponse(backend);
        var body = [
          {
            _key: 'alice'
          }
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            var responseBody = groongaUtils.groongaResponseBody(response);
            assert.deepEqual(responseBody, [1]);
            done();
          })
          .error(function(error) {
            done(error);
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
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
            var responseBody = groongaUtils.groongaResponseBody(response);
            assert.deepEqual(responseBody, [2]);
            done();
          })
          .error(function(error) {
            done(error);
          });
      });
    });

    suite('object style', function() {
      test('no _key', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var body = [
          {
            title: 'Droonga',
            content: 'Droonga is fun!'
          }
        ]
        utils.post('/d/load?table=Memos', JSON.stringify(body))
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
      });

      test('with columns', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var body = [
          {
            _key: 'alice',
            name: 'Alice',
            age: 20
          }
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
      });
    });

    suite('array style', function() {
      test('no _key', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
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
        utils.post('/d/load?table=Memos', JSON.stringify(body))
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
      });

      test('with columns', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var body = [
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
        ]
        utils.post('/d/load?table=Users', JSON.stringify(body))
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
      });

      test('with columns query parameter', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var path = '/d/load?table=Users&columns=_key,name,age';
        var body = [
          [
            'alice',
            'Alice',
            20
          ]
        ]
        utils.post(path, JSON.stringify(body))
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
      });
    });

    suite('GET', function() {
      test('object style', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
        var values = [
          {
            _key: 'alice',
            name: 'Alice',
            age: 20
          }
        ];
        var path = {
          pathname: '/d/load',
          query: {
            table: 'Users',
            values: JSON.stringify(values)
          }
        };
        utils.get(path)
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
      });

      test('array style', function(done) {
        var requestBody;
        backend.reserveResponse(function(requestPacket) {
          requestBody = requestPacket[2].body;
          return utils.createReplyPacket(requestPacket, successMessage);
        });
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
        var path = {
          pathname: '/d/load',
          query: {
            table: 'Users',
            values: JSON.stringify(values)
          }
        };
        utils.get(path)
          .next(function(response) {
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
          .error(function(error) {
            done(error);
          });
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
      utils.post('/d/load', JSON.stringify(body))
        .next(function(responseMessage) {
          var actual = {
            httpStatusCode: responseMessage.statusCode,
            groongaStatusCode: groongaUtils.groongaResponseHeader(responseMessage)[0],
            errorMessage: groongaUtils.groongaResponseHeader(responseMessage)[3],
            body: groongaUtils.groongaResponseBody(responseMessage)
          }
          assert.deepEqual(actual,
                           {
                             httpStatusCode: 400,
                             groongaStatusCode: -22,
                             errorMessage: 'required parameter is missing: <table>',
                             body: [0]
                           });
          done();
        })
        .error(function(error) {
          done(error);
        });
    });
  });
});
