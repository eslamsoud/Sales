const token = 'v1.public.eyJqdGkiOiJmM2VmYjU5My04NGNjLTQ5YjAtOTAwZC1hMTg1MzNmYjQ4OTIifbGIgbD0xoX_KMvhicqhyzwWWBTPXTy3WrY5PLikedMMw4Fr_F3eOfca8EqNGdZLonU0j26zPX5WUcmHclIXfzenWfhd8fWIx15d8w73HqHZrqL_3HPZr98UO5ravj7iX4zTyOdUcm6MLXd4H9J98ii4rXKTgLV3d8MwcOfd6mzWHvAJ4kUoHTqtaNIS7TEt7ZeWWBXKtOgDfnhGolpZyWMezwkn3U1ISRuRpMbCbbrFnPeJngj-T_-Ob8pzxUjRF0f2KOA_Rs77_JwbPQWPVr_Zj00uEGHx2ODn153BnbGdI_5Un3CsFrq0YhfRIob2BG74YInPMrGdpLJKN02d2y8.N2IyNTQ2ODQtOWE1YS00MmI2LTkyOTItMGJlNGMxODU1Mzc2';
const parts = token.split('.');
console.log('Header:', Buffer.from(parts[1], 'base64').toString());
const payload = parts[2];
// base64 url decode
let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
while (b64.length % 4) {
  b64 += '=';
}
try { console.log('Payload:', Buffer.from(b64, 'base64').toString()); } catch(e){}
