var util = require('util');

function CatalogV2(raw) {
  this._raw = raw;
}
CatalogV2.prototype = {
  get allHostNames() {
    if (this._allHostNames)
      return this._allHostNames;
    var uniqueHostNames = {};
    this.datasets.forEach(function(dataset) {
      dataset.allHostNames.forEach(function(hostName) {
        uniqueHostNames[hostName] = true;
      });
    });
    return this._allHostNames = Object.keys(uniqueHostNames).sort();
  },
  get datasets() {
    if (this._datasets)
      return this._datasets;
    return this._datasets = Object.keys(this._raw.datasets || {})
                              .map((function(datasetName) {
                                return new Dataset(datasetName,
                                                   this._raw.datasets[datasetName]);
                              }).bind(this));
  }
};


function VolumeCollectionOwner(raw) {
  this._raw = raw;
}
VolumeCollectionOwner.prototype = {
  get allHostNames() {
    if (this._allHostNames)
      return this._allHostNames;

    var uniqueHostNames = {};

    this.replicas.forEach(function(replica) {
      replica.allHostNames.forEach(function(hostName) {
        uniqueHostNames[hostName] = true;
      });
    });

    this.slices.forEach(function(replica) {
      replica.allHostNames.forEach(function(hostName) {
        uniqueHostNames[hostName] = true;
      });
    });

    if (this.ownVolume)
      uniqueHostNames[this.ownVolume.hostName] = true;

    return this._allHostNames = Object.keys(uniqueHostNames).sort();
  },

  get replicas() {
    if (this._replicas)
      return this._replicas;
    return this._replicas = (this._raw.replicas || []).map(function(replica) {
                              return new Replica(replica);
                            });
  },

  get slices() {
    if (this._slices)
      return this._slices;
    return this._slices = (this._raw.slices || []).map(function(slice) {
                              return new Slice(slice);
                            });
  },

  ADDRESS_PATTERN: /^([^:]+)(?::(\d+))?\/([^\.]+)\.(.+)$/, // hostName, port, tag, path
  get ownVolume() {
    if (typeof this._ownVolume !== 'undefined')
      return this._ownVolume;

    if (this._raw.volume && this._raw.volume.address) {
      var address = this._raw.volume.address;
      var match = address.match(this.ADDRESS_PATTERN);
      this._ownVolume = {
        hostName: match[1]
      };
    }
    else {
      this._ownVolume = null;
    }
    return this._ownVolume;
  }
};


function Dataset(name, raw) {
  this.name = name;
  this._raw = raw;
}
util.inherits(Dataset, VolumeCollectionOwner);

function Replica(raw) {
  this._raw = raw;
}
util.inherits(Replica, VolumeCollectionOwner);

function Slice(raw) {
  this._raw = raw;
}
util.inherits(Slice, VolumeCollectionOwner);


exports.CatalogV2 = CatalogV2;
