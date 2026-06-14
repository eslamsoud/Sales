const token = 'v1.public.eyJqdGkiOiJmM2VmYjU5My04NGNjLTQ5YjAtOTAwZC1hMTg1MzNmYjQ4OTIifbGIgbD0xoX_KMvhicqhyzwWWBTPXTy3WrY5PLikedMMw4Fr_F3eOfca8EqNGdZLonU0j26zPX5WUcmHclIXfzenWfhd8fWIx15d8w73HqHZrqL_3HPZr98UO5ravj7iX4zTyOdUcm6MLXd4H9J98ii4rXKTgLV3d8MwcOfd6mzWHvAJ4kUoHTqtaNIS7TEt7ZeWWBXKtOgDfnhGolpZyWMezwkn3U1ISRuRpMbCbbrFnPeJngj-T_-Ob8pzxUjRF0f2KOA_Rs77_JwbPQWPVr_Zj00uEGHx2ODn153BnbGdI_5Un3CsFrq0YhfRIob2BG74YInPMrGdpLJKN02d2y8.N2IyNTQ2ODQtOWE1YS00MmI2LTkyOTItMGJlNGMxODU1Mzc2';

async function testRegion(region) {
  const v1 = `https://places.geo.${region}.amazonaws.com/places/v0/indexes/MyPlaceIndex/search/position?key=${token}`;
  
  // The user might be using Amazon Location v2 API Places
  // Let's try text search without an index if possible
  const url = `https://places.geo.${region}.amazonaws.com/v2/places/search-text?key=${token}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ QueryText: "restaurant", MaxResults: 1 })
    });
    console.log(region, res.status, await res.text());
  } catch (e) {
    console.error(region, e.message);
  }
}

['us-east-1', 'eu-west-1', 'eu-central-1', 'us-west-2'].forEach(testRegion);
