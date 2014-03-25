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

  if ('attributes' in queryParams) {
    queries[queryName].output.attributes = queryParams.attributes.split(',');
  } else {
    queries[queryName].output.attributes = [];
  }
  if ('limit' in queryParams)
    queries[queryName].output.limit = getIntegerValue(queryParams, 'limit');

  if ('match_escalation_threshold' in queryParams)
    queryCondition.matchEscalationThreshold = getIntegerValue(queryParams, 'match_escalation_threshold');
  if ('match_to' in queryParams)
    queryCondition.matchTo = queryParams.match_to.split(',');
  if ('query' in queryParams)
    queryCondition.query = queryParams.query;
  if ('script' in queryParams)
    scriptCondition.script = queryParams.script;
  if ('query' in queryCondition || 'script' in scriptCondition) {
    if (!('query' in queryCondition)) {
      queries[queryName].condition = scriptCondition;
    } else if (!('script' in scriptCondition)) {
      queries[queryName].condition = queryCondition;
    } else {
      queries[queryName].condition = [
        '&&',
        queryCondition,
        scriptCondition
      ]
    }
  }

  if ('offset' in queryParams)
    queries[queryName].output.offset = getIntegerValue(queryParams, 'offset');
  if ('sort_by' in queryParams)
    queries[queryName].sortBy = queryParams.sort_by.split(',');

  var message = {};
  message.queries = queries;

  if ('timeout' in queryParams)
    message.timeout = getIntegerValue(queryParams, 'timeout');

  return message;
}
exports.search = searchRequestBuilder;
