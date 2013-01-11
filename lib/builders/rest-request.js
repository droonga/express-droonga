function searchRequestBuilder(request) {
  var params = request.params;

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
    queries.result.limit = parseInt(params.limit);
  if (params.match_escalation_threshold)
    queries.result.matchEscalationThreshold = parseInt(params.match_escalation_threshold);
  if (params.match_to)
    queries.result.matchTo = params.match_to.split(',');
  if (params.offset)
    queries.result.offset = parseInt(params.offset);
  if (params.query)
    queries.result.query = params.query;
  if (params.sort_by)
    queries.result.sortBy = params.sort_by.split(',');

  return { queries: queries };
}
exports.search = searchRequestBuilder;
