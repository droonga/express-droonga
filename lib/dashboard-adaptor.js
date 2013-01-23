var express = require('express');
var less = require('less-middleware');
var path = require('path');

exports.registerHandlers = function(application, params) {
  params = params || {};

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  application.configure(function(){
    application.set('views', path.join(__dirname, '..', 'views'));
    application.set('view engine', 'ejs');
    application.use(prefix, express.favicon());
    application.use(prefix, express.logger('dev'));
    application.use(prefix, express.bodyParser());
    application.use(prefix, express.methodOverride());
    application.use(prefix, less({ src: path.join(__dirname, '..', 'public') }));
    application.use(prefix, express.static(path.join(__dirname, '..', 'public')));
  });

  application.configure('development', function(){
    application.use(prefix, express.errorHandler());
  });

  application.get(prefix + '/dashboard', function(request, response) {
    response.render('index', { title: '', prefix: prefix });
  });
}
