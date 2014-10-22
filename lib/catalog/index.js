var CatalogV2 = require('./v2').CatalogV2;

function Catalog(raw) {
  switch (raw.version) {
    case 2:
      return new CatalogV2(raw);
    default:
      throw new Error('catalog version ' + raw.version + ' is not supported.');
  }
};

exports.Catalog = Catalog;
