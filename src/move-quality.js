/** Loss on JellyFish's native ranking scale. Match adjustments are not XG EMG. */
export function moveQuality(bestScore,playedScore){
  const loss=Math.max(0,bestScore-playedScore);
  if(!Number.isFinite(loss))return null;
  const quality=loss>0.080+1e-12?'blunder':loss>0.020+1e-12?'error':'ok';
  return {loss,quality,label:{ok:'OK',error:'Error',blunder:'Blunder'}[quality]};
}
