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

  if (typeof queryParams.attributes == 'string') {
    queries[queryName].output.attributes = queryParams.attributes.split(',');
  } else {
    queries[queryName].output.attributes = [];
  }
  if (typeof queryParams.limit == 'string')
    queries[queryName].output.limit = getIntegerValue(queryParams, 'limit');

  if (typeof queryParams.match_escalation_threshold == 'string')
    queryCondition.matchEscalationThreshold = getIntegerValue(queryParams, 'match_escalation_threshold');
  if (typeof queryParams.match_to == 'string')
    queryCondition.matchTo = queryParams.match_to.split(',');
  if (typeof queryParams.query == 'string')
    queryCondition.query = queryParams.query;
  if (typeof queryParams.script == 'string')
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

  if (typeof queryParams.offset == 'string')
    queries[queryName].output.offset = getIntegerValue(queryParams, 'offset');
  if (typeof queryParams.sort_by == 'string')
    queries[queryName].sortBy = queryParams.sort_by.split(',');

  var message = {};
  message.queries = queries;

  if (typeof queryParams.timeout == 'string')
    message.timeout = getIntegerValue(queryParams, 'timeout');

  return message;
}
exports.search = searchRequestBuilder;
