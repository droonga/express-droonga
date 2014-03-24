var inflection = require('inflection');


var NUMERIC = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/;
function getNumericValue(params, key) {
  var value = params[key];
  if (!NUMERIC.test(value))
    throw new Error(key + ': ' + value + ' is invalid number');
  return parseFloat(value);
}

var INTEGER = /^-?[0-9]+$/;
function getIntegerValue(params, key) {
  var value = params[key];
  if (!INTEGER.test(value))
    throw new Error(key + ': ' + value + ' is invalid integer');
  return parseInt(value);
}

function searchRequestBuilder(request) {
  var params = request.params;
  if (!params.tableName)
    throw new Error('no source is specified');

  var queryParams = request.query;

  var queries = {};
  var queryCondition = {};
  var scriptCondition = {};
  var queryName = params.tableName;
  try {
    queryName = inflection.tableize(queryName);
    queryName = inflection.camelize(queryName, true);
  } catch(error) {
    queryName = params.tableName.toLowerCase();
  }
  queries[queryName] = {
    source: params.tableName,
    output: {
      elements: [
        'startTime',
        'elapsedTime',
        'count',
        'attributes',
        'records'
      ],
    }
  };

  if (queryParams.attributes) {
    queries[queryName].output.attributes = queryParams.attributes.split(',');
  } else {
    queries[queryName].output.attributes = [];
  }
  if (queryParams.limit)
    queries[queryName].output.limit = getIntegerValue(queryParams, 'limit');

  if (queryParams.match_escalation_threshold)
    queryCondition.matchEscalationThreshold = getIntegerValue(queryParams, 'match_escalation_threshold');
  if (queryParams.match_to)
    queryCondition.matchTo = queryParams.match_to.split(',');
  if (queryParams.query)
    queryCondition.query = queryParams.query;
  if (queryParams.script)
    scriptCondition.script = queryParams.script;
  if (queryCondition.query || scriptCondition.script) {
    if (!queryCondition.query) {
      queries[queryName].condition = scriptCondition;
    } else if (!scriptCondition.script) {
      queries[queryName].condition = queryCondition;
    } else {
      queries[queryName].condition = [
        '&&',
        queryCondition,
        scriptCondition
      ]
    }
  }

  if (queryParams.offset)
    queries[queryName].output.offset = getIntegerValue(queryParams, 'offset');
  if (queryParams.sort_by)
    queries[queryName].sortBy = queryParams.sort_by.split(',');

  var message = {};
  message.queries = queries;

  if (queryParams.timeout)
    message.timeout = getIntegerValue(queryParams, 'timeout');

  return message;
}
exports.search = searchRequestBuilder;
