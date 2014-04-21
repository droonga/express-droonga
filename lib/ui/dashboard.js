var express = require('express');
var less = require('less-middleware');
var path = require('path');

exports.register = function(application, params) {
  params = params || {};

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  var topDirectory = path.join(__dirname, '..', '..', '..');

  application.set('views', path.join(topDirectory, 'views'));
  application.set('view engine', 'jade');
  application.use(prefix, express.favicon());
  application.use(prefix, express.bodyParser());
  application.use(prefix, express.methodOverride());
  application.use(prefix, less(path.join(topDirectory, 'public')));
  application.use(prefix, express.static(path.join(topDirectory, 'public')));

  var env = process.env.NODE_ENV || 'development';
  if (env == 'development') {
    application.use(prefix, express.errorHandler());
  }

  application.get(prefix + '/dashboard', function(request, response) {
    response.render('index', { title: '', prefix: prefix });
  });
}
