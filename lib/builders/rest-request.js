var NUMERIC = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/;
function getNumericValue(params, key) {
  var value = params[key];
  if (!NUMERIC.test(value))
    throw new Error(key + ': ' +value + ' is invalid number');
  return parseFloat(value);
}

var INTEGER = /^-?[0-9]+$/;
function getIntegerValue(params, key) {
  var value = params[key];
  if (!INTEGER.test(value))
    throw new Error(key + ': ' +value + ' is invalid integer');
  return parseInt(value);
}

function searchRequestBuilder(request) {
  var params = request.params;
  if (!params.tableName)
    throw new Error('no source is specified');

  var queries = {};
  queries.result = {
    source: params.tableName,
    output: {
      startTime:   true,
      elapsedTime: true,
      count:       true,
      attributes:  true,
      recodes:     true
    }
  };

  if (params.attributes)
    queries.result.attributes = params.attributes.split(',');
  if (params.limit)
    queries.result.limit = getIntegerValue(params, 'limit');
  if (params.match_escalation_threshold)
    queries.result.matchEscalationThreshold = getIntegerValue(params, 'match_escalation_threshold');
  if (params.match_to)
    queries.result.matchTo = params.match_to.split(',');
  if (params.offset)
    queries.result.offset = getIntegerValue(params, 'offset');
  if (params.query)
    queries.result.query = params.query;
  if (params.sort_by)
    queries.result.sortBy = params.sort_by.split(',');

  return { queries: queries };
}
exports.search = searchRequestBuilder;
