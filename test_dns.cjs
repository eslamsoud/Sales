const dns = require('dns');

['geo-places.eu-north-1.amazonaws.com', 'places.geo.eu-north-1.amazonaws.com', 'places.geo-places.eu-north-1.amazonaws.com'].forEach(host => {
  dns.lookup(host, (err, address) => {
    console.log(host, err ? err.code : address);
  });
});
