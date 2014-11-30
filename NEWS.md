# News

## 1.0.8: 2014-XX-XX

 * Connects to active engine nodes of the cluster of the associated engine node correctly.
   Previous version unexpectedly kept connections to already unjoined engine nodes.

## 1.0.7: 2014-11-29

 * Supports multiple Droonga Engine nodes as its backends.
   Now express-droonga can work like a load balancer.
 * The list of connecting Droonga Engine nodes can be automatically updated
   based on the actual list of active members in the cluster.
   This feature is activated by the `syncHostNames` option for the `application.droonga()` method.

## 1.0.6: 2014-10-07

 * Debug logs are now reported via given logger.

## 1.0.5: 2014-09-29

 * Return cached responses correctly.

## 1.0.4: 2014-06-29

 * Supports paths like `/droonga/(command name)` with `GET` method.
 * Supports paths like `/droonga/(command namespace)/(command name)` with `GET` and `POST` method.
 * Works with the [Express 4.4.4](http://expressjs.com/).

## 1.0.3: 2014-05-29

 * Groonga compatible `load` command with `GET` method is available.
 * Query parameter `group_by[(column name)][attributes]` for the REST `search` command now accepts simple comma-separeted string value.

## 1.0.2: 2014-04-29

 * Works with the [Express 4.0](http://expressjs.com/).
 * Keeps the process alive even if it is disconnected from the Droonga Engine.
 * Groonga compatible `load` command with `POST` method is available.
   (Note: `load` command with `GET` method is not supported yet.)

## 1.0.1: 2014-03-29

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
