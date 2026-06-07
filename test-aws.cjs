(async () => {
    const awsKey = 'v1.public.eyJqdGkiOiJmM2VmYjU5My04NGNjLTQ5YjAtOTAwZC1hMTg1MzNmYjQ4OTIifbGIgbD0xoX_KMvhicqhyzwWWBTPXTy3WrY5PLikedMMw4Fr_F3eOfca8EqNGdZLonU0j26zPX5WUcmHclIXfzenWfhd8fWIx15d8w73HqHZrqL_3HPZr98UO5ravj7iX4zTyOdUcm6MLXd4H9J98ii4rXKTgLV3d8MwcOfd6mzWHvAJ4kUoHTqtaNIS7TEt7ZeWWBXKtOgDfnhGolpZyWMezwkn3U1ISRuRpMbCbbrFnPeJngj-T_-Ob8pzxUjRF0f2KOA_Rs77_JwbPQWPVr_Zj00uEGHx2ODn153BnbGdI_5Un3CsFrq0YhfRIob2BG74YInPMrGdpLJKN02d2y8.N2IyNTQ2ODQtOWE1YS00MmI2LTkyOTItMGJlNGMxODU1Mzc2';
    const endpoint = `https://places.geo.eu-north-1.amazonaws.com/v2/search-text?key=${awsKey}`;
    const storeType = 'سوبر ماركت';
    const finalArea = 'القاهرة';
    const lng = 31.2357;
    const lat = 30.0444;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        QueryText: storeType + " في " + finalArea,
        BiasPosition: [lng, lat],
        MaxResults: 5,
        AdditionalFeatures: ["Contact"]
      })
    });
  console.log(JSON.stringify(await response.json(), null, 2));
})();
