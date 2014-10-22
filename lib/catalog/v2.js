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
    return this._allHostNames = Object.keys(uniqueHostNames);
  },
  get datasets() {
    if (this._datasets)
      return this._datasets;
    return this._datasets = Object.keys(this._raw.datasets)
                              .map((function(datasetName) {
                                return new Dataset(datasetName,
                                                   this._raw.datasets[datasetName]);
                              }).bind(this));
  }
};

function Dataset(name, raw) {
  this.name = name;
  this._raw = raw;
}
Dataset.prototype = {
  get allHostNames() {
    if (this._allHostNames)
      return this._allHostNames;
    var uniqueHostNames = {};
    this.replicas.forEach(function(replica) {
      replica.allHostNames.forEach(function(hostName) {
        uniqueHostNames[hostName] = true;
      });
    });
    return this._allHostNames = Object.keys(uniqueHostNames);
  },
  get replicas() {
    if (this._replicas)
      return this._replicas;
    return this._replicas = this._raw.replicas.map(function(replica) {
                              return new Replica(replica);
                            });
  }
};

function Replica(raw) {
  this._raw = raw;
}
Replica.prototype = {
  get allHostNames() {
    if (this._allHostNames)
      return this._allHostNames;
    var uniqueHostNames = {};
    this.slices.forEach(function(slice) {
      slice.allHostNames.forEach(function(hostName) {
        uniqueHostNames[hostName] = true;
      });
    });
    return this._allHostNames = Object.keys(uniqueHostNames);
  },
  get slices() {
    if (this._slices)
      return this._slices;
    return this._slices = this._raw.slices.map(function(slice) {
                              return new Slice(slice);
                            });
  }
};

function Slice(raw) {
  this._raw = raw;
}
Slice.prototype = {
  ADDRESS_PATTERN: /^([^:]+)(?::(\d+))?\/([^\.]+)\.(.+)$/, // hostName, port, tag, path
  get allHostNames() {
    if (this._allHostNames)
      return this._allHostNames;
    var address = this._raw.volume.address;
    var match = address.match(this.ADDRESS_PATTERN);
    return this._allHostNames = [match[0]];
  }
};

exports.CatalogV2 = CatalogV2;
