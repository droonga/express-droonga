var assert = require('chai').assert;

var utils = require('../../test-utils');

var express = require('express');
var httpAdapter = require('../../../lib/adapter/http');
var command = require('../../../lib/adapter/command');

suite('adapter/http.register', function() {
  suite('commandSet', function() {
    function StubApplication() {
      this.getPaths    = [];
      this.postPaths   = [];
      this.putPaths    = [];
      this.deletePaths = [];
    }

    StubApplication.prototype.configure = function() {
    };

    StubApplication.prototype.get = function(path, handler) {
      this.getPaths.push(path);
    };
    StubApplication.prototype.post = function(path, handler) {
      this.postPaths.push(path);
    };
    StubApplication.prototype.put = function(path, handler) {
      this.putPaths.push(path);
    };
    StubApplication.prototype.delete = function(path, handler) {
      this.deletePaths.push(path);
    };

    StubApplication.prototype.paths = function() {
      var paths = {}
      if (this.getPaths.length > 0) {
        paths.get = this.getPaths;
      }
      if (this.postPaths.length > 0) {
        paths.post = this.postPaths;
      }
      if (this.putPaths.length > 0) {
        paths.put = this.putPaths;
      }
      if (this.deletePaths.length > 0) {
        paths.delete = this.deletePaths;
      }
      return paths;
    };

    function register(commandSet) {
      var application = new StubApplication();
      httpAdapter.register(application, {
        prefix:     '',
        connection: utils.createStubbedBackendConnection(),
        plugins: [
          commandSet
        ]
      });
      return application.paths();
    }

    suite('method', function() {
    test('default', function() {
      var noMethodCommand = new command.HTTPRequestResponse({
        path: '/no-method'
      });
      assert.deepEqual(register({ 'no-method': noMethodCommand }),
                       { 'get': ['/no-method'] });
    });

    test('get', function() {
      var getMethodCommand = new command.HTTPRequestResponse({
        path:   '/get',
        method: 'GET'
      });
      assert.deepEqual(register({ 'get-method': getMethodCommand }),
                       { 'get': ['/get'] });
    });

    test('post', function() {
      var postMethodCommand = new command.HTTPRequestResponse({
        path:   '/post',
        method: 'POST'
      });
      assert.deepEqual(register({ 'post-method': postMethodCommand }),
                       { 'post': ['/post'] });
    });

    test('put', function() {
      var putMethodCommand = new command.HTTPRequestResponse({
        path:   '/put',
        method: 'PUT'
      });
      assert.deepEqual(register({ 'put-method': putMethodCommand }),
                       { 'put': ['/put'] });
    });

    test('delete', function() {
      var deleteMethodCommand = new command.HTTPRequestResponse({
        path:   '/delete',
        method: 'DELETE'
      });
      assert.deepEqual(register({ 'delete-method': deleteMethodCommand }),
                       { 'delete': ['/delete'] });
    });
    });
  });
});

