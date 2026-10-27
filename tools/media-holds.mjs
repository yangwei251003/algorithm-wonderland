// A source-only correction may leave the calculation input unchanged. Bind
// known defects to the actual old movie, not just the lesson or input version.
export function movieHold(manifest,id,sha256){
 if(manifest?.version!==1||!Array.isArray(manifest.holds))throw new Error('Invalid media hold manifest');
 return manifest.holds.find(h=>h.algorithmId===id&&h.sha256===sha256)||null;
}
