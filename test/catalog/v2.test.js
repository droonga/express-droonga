var assert = require('chai').assert;

var utils = require('../test-utils');

var CatalogV2 = require('../../lib/catalog/v2').CatalogV2;

function singleVolumeWithHostName(hostname, localPath) {
  localPath = localPath || '000';
  return {
    volume: {
      address: hostname + ':10031/droonga.' + localPath
    }
  };
}

suite('CatalogV2', function() {
  suite('allHostNames', function() {
    test('no dataset', function() {
      var catalog = new CatalogV2({
        version: 2
      });
      assert.deepEqual(catalog.allHostNames, [])
    });

    test('blank datasets', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
        }
      });
      assert.deepEqual(catalog.allHostNames, [])
    });

    test('datasets', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          dataset1: singleVolumeWithHostName('127.0.0.1'),
          dataset2: singleVolumeWithHostName('127.0.0.2'),
          dataset3: singleVolumeWithHostName('127.0.0.3')
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2',
        '127.0.0.3'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });

    test('replicas', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          datasetWithReplicas: {
            replicas: [
              singleVolumeWithHostName('127.0.0.1'),
              singleVolumeWithHostName('127.0.0.2')
            ]
          }
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });

    test('slices in replicas', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          datasetWithReplicas: {
            replicas: [
              {
                slices: [
                  singleVolumeWithHostName('127.0.0.1'),
                  singleVolumeWithHostName('127.0.0.2')
                ]
              },
              {
                slices: [
                  singleVolumeWithHostName('127.0.0.11'),
                  singleVolumeWithHostName('127.0.0.12')
                ]
              }
            ]
          }
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2',
        '127.0.0.11',
        '127.0.0.12'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });

    test('slices', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          datasetWithSlices: {
            slices: [
              singleVolumeWithHostName('127.0.0.1'),
              singleVolumeWithHostName('127.0.0.2')
            ]
          }
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });

    test('replicas in slices', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          datasetWithSlices: {
            slices: [
              {
                replicas: [
                  singleVolumeWithHostName('127.0.0.1'),
                  singleVolumeWithHostName('127.0.0.2')
                ]
              },
              {
                replicas: [
                  singleVolumeWithHostName('127.0.0.11'),
                  singleVolumeWithHostName('127.0.0.12')
                ]
              }
            ]
          }
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2',
        '127.0.0.11',
        '127.0.0.12'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });

    test('deeply nested (recomended structure)', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          topLevelDataset: {
            replicas: [
              { // main
                slices: [
                  {
                    replicas: [
                      singleVolumeWithHostName('127.0.0.1'),
                      singleVolumeWithHostName('127.0.0.2')
                    ]
                  },
                  {
                    replicas: [
                      singleVolumeWithHostName('127.0.0.11'),
                      singleVolumeWithHostName('127.0.0.12')
                    ]
                  }
                ]
              },
              { // sub, new slice structure
                slices: [
                  {
                    replicas: [
                      singleVolumeWithHostName('127.0.0.21'),
                      singleVolumeWithHostName('127.0.0.22')
                    ]
                  },
                  {
                    replicas: [
                      singleVolumeWithHostName('127.0.0.31'),
                      singleVolumeWithHostName('127.0.0.32')
                    ]
                  },
                  {
                    replicas: [
                      singleVolumeWithHostName('127.0.0.41'),
                      singleVolumeWithHostName('127.0.0.42')
                    ]
                  }
                ]
              }
            ]
          }
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2',
        '127.0.0.11',
        '127.0.0.12',
        '127.0.0.21',
        '127.0.0.22',
        '127.0.0.31',
        '127.0.0.32',
        '127.0.0.41',
        '127.0.0.42'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });

    test('same host, different local path', function() {
      var catalog = new CatalogV2({
        version: 2,
        datasets: {
          topLevelDataset: {
            replicas: [
              singleVolumeWithHostName('127.0.0.1', '000'),
              singleVolumeWithHostName('127.0.0.2', '000'),
              singleVolumeWithHostName('127.0.0.1', '001'),
              singleVolumeWithHostName('127.0.0.2', '001')
            ]
          }
        }
      });
      var expectedAllHostNames = [
        '127.0.0.1',
        '127.0.0.2'
      ].sort();
      assert.deepEqual(catalog.allHostNames, expectedAllHostNames)
    });
  });
});
