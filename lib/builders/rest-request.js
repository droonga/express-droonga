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

  if (typeof params.attributes == 'string')
    queries.result.attributes = params.attributes.split(',');
  if (typeof params.limit == 'string')
    queries.result.limit = getIntegerValue(params, 'limit');
  if (typeof params.match_escalation_threshold == 'string')
    queries.result.matchEscalationThreshold = getIntegerValue(params, 'match_escalation_threshold');
  if (typeof params.match_to == 'string')
    queries.result.matchTo = params.match_to.split(',');
  if (typeof params.offset == 'string')
    queries.result.offset = getIntegerValue(params, 'offset');
  if (typeof params.query == 'string')
    queries.result.query = params.query;
  if (typeof params.sort_by == 'string')
    queries.result.sortBy = params.sort_by.split(',');

  return { queries: queries };
}
exports.search = searchRequestBuilder;
