const token = 'v1.public.eyJqdGkiOiJmM2VmYjU5My04NGNjLTQ5YjAtOTAwZC1hMTg1MzNmYjQ4OTIifbGIgbD0xoX_KMvhicqhyzwWWBTPXTy3WrY5PLikedMMw4Fr_F3eOfca8EqNGdZLonU0j26zPX5WUcmHclIXfzenWfhd8fWIx15d8w73HqHZrqL_3HPZr98UO5ravj7iX4zTyOdUcm6MLXd4H9J98ii4rXKTgLV3d8MwcOfd6mzWHvAJ4kUoHTqtaNIS7TEt7ZeWWBXKtOgDfnhGolpZyWMezwkn3U1ISRuRpMbCbbrFnPeJngj-T_-Ob8pzxUjRF0f2KOA_Rs77_JwbPQWPVr_Zj00uEGHx2ODn153BnbGdI_5Un3CsFrq0YhfRIob2BG74YInPMrGdpLJKN02d2y8.N2IyNTQ2ODQtOWE1YS00MmI2LTkyOTItMGJlNGMxODU1Mzc2';

const regions = ['us-east-1', 'eu-west-1', 'eu-central-1'];
const indices = ['explore.place', 'MyPlaceIndex', 'default', 'places'];

async function testIt() {
  for (let r of regions) {
    for (let idx of indices) {
      const url = `https://places.geo.${r}.amazonaws.com/places/v0/indexes/${idx}/search/position?key=${token}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Position: [31.2357, 30.0444], MaxResults: 1 })
        });
        if (res.status !== 403 && res.status !== 404) {
          console.log(`Success! Region: ${r}, Index: ${idx}, Status: ${res.status}`);
        }
      } catch (e) {}
    }
  }
  console.log("Done testing");
}
testIt();
