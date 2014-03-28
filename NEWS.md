# News

## 1.0.1: 2014-03-29 (planned)

 * The bundled HTTP server application is removed.
   Instead, use another project [droonga-http-server](https://github.com/droonga/droonga-http-server).
 * Parallel connections from the Droonga Engine are established correctly.
 * A middleware for response caches is available now.
   You can see the statistics via `/cache/statistics`.
 * Query parameters `attributes`, `group_by`, and `adjusters` are available for a REST `search` command (via `/tables/:tableName`).

## 1.0.0: 2014-02-28

The first major release! No changes since 0.9.9.

## 0.9.9: 2014-02-09

### Improvements

  * search: Improved query name in `queries` parameter. It was always
    `result`. Now, it is guessed from table name parameter.

## 0.9.0: 2014-01-29

### Improvements

  * Supported HTTP streaming.

## 0.8.1: 2014-01-06

A bug fix release of 0.8.1.

## 0.8.0: 2013-12-29

## 0.7.0: 2013-11-29

The first release!
