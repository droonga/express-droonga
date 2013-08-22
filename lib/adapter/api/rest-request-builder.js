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
  queries.result = {
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

  if (typeof queryParams.attributes == 'string')
    queries.result.attributes = queryParams.attributes.split(',');
  if (typeof queryParams.limit == 'string')
    queries.result.limit = getIntegerValue(queryParams, 'limit');
  if (typeof queryParams.match_escalation_threshold == 'string')
    queries.result.matchEscalationThreshold = getIntegerValue(queryParams, 'match_escalation_threshold');
  if (typeof queryParams.match_to == 'string')
    queries.result.matchTo = queryParams.match_to.split(',');
  if (typeof queryParams.offset == 'string')
    queries.result.offset = getIntegerValue(queryParams, 'offset');
  if (typeof queryParams.query == 'string')
    queries.result.query = queryParams.query;
  if (typeof queryParams.sort_by == 'string')
    queries.result.sortBy = queryParams.sort_by.split(',');

  var message = {};
  message.queries = queries;

  if (typeof queryParams.timeout == 'string')
    message.timeout = getIntegerValue(queryParams, 'timeout');

  return message;
}
exports.search = searchRequestBuilder;
