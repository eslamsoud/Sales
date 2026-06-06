(async () => {
  const query = 'سوبر ماركت';
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=eg&accept-language=ar`;
  const response = await fetch(url, { headers: { 'User-Agent': 'MyApp/1.0' } });
  console.log(JSON.stringify(await response.json(), null, 2));
})();
