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

function getArrayValue(params, key) {
  if (!(key in params)) {
    return [];
  }

  var value = params[key];
  if (Array.isArray(value)) {
    return value;
  } else {
    return value.split(',');
  }
}

function buildAdjusters(requestAdjusters) {
  var adjusters = [];

  var keys = Object.keys(requestAdjusters)
  keys.forEach(function(key) {
    var requestAdjuster = requestAdjusters[key]
    var adjuster = {
      column: key
    };

    if ('column' in requestAdjuster)
      adjuster.column = requestAdjuster.column;
    // TODO: Value is required. Validate it.
    if ('value' in requestAdjuster)
      adjuster.value = requestAdjuster.value;
    if ('factor' in requestAdjuster)
      adjuster.factor = requestAdjuster.factor;

    adjusters.push(adjuster);
  });

  return adjusters;
}

function buildSearchQuery(tableName, queryParams) {
  var query = {
    source: tableName,
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

  query.output.attributes = getArrayValue(queryParams, 'attributes');
  if ('limit' in queryParams)
    query.output.limit = getIntegerValue(queryParams, 'limit');

  var queryCondition = {};
  var scriptCondition = {};
  if ('match_escalation_threshold' in queryParams)
    queryCondition.matchEscalationThreshold = getIntegerValue(queryParams, 'match_escalation_threshold');
  if ('match_to' in queryParams)
    queryCondition.matchTo = getArrayValue(queryParams, 'match_to');
  if ('query' in queryParams)
    queryCondition.query = queryParams.query;
  if ('script' in queryParams)
    scriptCondition.script = queryParams.script;
  if ('query' in queryCondition || 'script' in scriptCondition) {
    if (!('query' in queryCondition)) {
      query.condition = scriptCondition;
    } else if (!('script' in scriptCondition)) {
      query.condition = queryCondition;
    } else {
      query.condition = [
        '&&',
        queryCondition,
        scriptCondition
      ]
    }
  }

  if ('adjusters' in queryParams)
    query.adjusters = buildAdjusters(queryParams.adjusters);

  if ('offset' in queryParams)
    query.output.offset = getIntegerValue(queryParams, 'offset');
  if ('sort_by' in queryParams)
    query.sortBy = getArrayValue(queryParams, 'sort_by');

  return query;
}

function buildGroupByQuery(sourceQueryName, params) {
  var query = {
    source: sourceQueryName,
    groupBy: {
    },
    output: {
      elements: [
        'count',
        'records'
      ]
    }
  };

  if ('key' in params)
    query.groupBy.key = params.key;
  if ('max_n_sub_records' in params)
    query.groupBy.maxNSubRecords = getIntegerValue(params, 'max_n_sub_records');

  if ('attributes' in params) {
    var requestAttributes = params.attributes;
    var keys = Object.keys(requestAttributes);
    var attributes = [];
    keys.forEach(function(key) {
      var requestAttribute = requestAttributes[key];
      var attribute = {
        label: key
      };
      attribute.source = requestAttribute.source;
      if ('attributes' in requestAttribute)
        attribute.attributes = requestAttribute.attributes;
      attributes.push(attribute);
    });
    query.output.attributes = attributes;
  }

  if ('limit' in params) {
    query.output.limit = getIntegerValue(params, 'limit');
  }

  return query;
}

function searchRequestBuilder(request) {
  var params = request.params;
  if (!params.tableName)
    throw new Error('no source is specified');

  var queryParams = request.query;

  var queries = {};
  var queryName = params.tableName;
  try {
    queryName = inflection.tableize(queryName);
    queryName = inflection.camelize(queryName, true);
  } catch(error) {
    queryName = params.tableName.toLowerCase();
  }
  queries[queryName] = buildSearchQuery(params.tableName, queryParams);
  if ('group_by' in queryParams) {
    var group_by_queries = queryParams.group_by;
    var keys = Object.keys(group_by_queries);
    keys.forEach(function(key) {
      queries[key] = buildGroupByQuery(queryName, group_by_queries[key]);
    });
  }

  var message = {};
  message.queries = queries;

  if ('timeout' in queryParams)
    message.timeout = getIntegerValue(queryParams, 'timeout');

  return message;
}
exports.search = searchRequestBuilder;
