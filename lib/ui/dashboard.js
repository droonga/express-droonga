var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var serveStatic = require('serve-static');
var errorhandler = require('errorhandler');
var less = require('less-middleware');
var path = require('path');

exports.register = function(application, params) {
  params = params || {};

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  var topDirectory = path.join(__dirname, '..', '..', '..');

  application.set('views', path.join(topDirectory, 'views'));
  application.set('view engine', 'jade');
  application.use(prefix, bodyParser.json());
  application.use(prefix, methodOverride());
  application.use(prefix, less(path.join(topDirectory, 'public')));
  application.use(prefix, serveStatic(path.join(topDirectory, 'public')));

  var env = process.env.NODE_ENV || 'development';
  if (env == 'development') {
    application.use(prefix, errorhandler());
  }

  application.get(prefix + '/dashboard', function(request, response) {
    response.render('index', { title: '', prefix: prefix });
  });
}
