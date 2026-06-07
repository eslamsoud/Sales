(async () => {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["shop"~"supermarket|convenience"](around:2000,30.0444,31.2357);
      way["shop"~"supermarket|convenience"](around:2000,30.0444,31.2357);
    );
    out center;
  `;
  const osmResponse = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(overpassQuery)
  });
  const data = await osmResponse.json();
  console.log(data.elements.length);
  console.log(JSON.stringify(data.elements.slice(0,3), null, 2));
})();
