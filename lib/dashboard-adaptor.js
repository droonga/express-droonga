exports.registerHandlers = function(application, params) {
  params = params || {};

  var prefix = params.prefix || '';
  prefix = prefix.replace(/\/$/, '');

  application.set('views', path.join(__dirname, '..', 'views');
  application.use(express.favicon());
  application.use(express.logger('dev'));
  application.use(express.bodyParser());
  application.use(express.static(path.join(__dirname, '..', 'public')));

  application.get(prefix + '/dashboard', function(request, response) {
    response.render('index');
  });
}
