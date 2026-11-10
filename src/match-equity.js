/** Native match-equity helper 0x425740: table recovered from immediate
 * stack initializers in assembly (the decompiler omits these values).
 * Rows/columns are points needed to win, 1..11; values are percentages.
 */
export const MATCH_EQUITY_PERCENT = Object.freeze([[50,70,75,83,85,90,91,94,95,97,97],[30,50,60,68,75,81,85,88,91,93,94],[25,40,50,59,66,71,76,80,84,87,90],[17,32,41,50,58,64,70,75,79,83,86],[15,25,34,42,50,57,63,68,73,77,81],[10,19,29,36,43,50,56,62,67,72,76],[9,15,24,30,37,44,50,56,61,66,70],[6,12,20,25,32,38,44,50,55,60,65],[5,9,16,21,27,33,39,45,50,55,60],[3,7,13,17,23,28,34,40,45,50,55],[3,6,10,14,19,24,30,35,40,45,50]].map(row=>Object.freeze(row)));
export function nativeMatchEquity(ownAway,opponentAway,mode=1) {
  if(!Number.isInteger(ownAway)||!Number.isInteger(opponentAway))throw new Error('Match distances must be integers');
  if(mode===0)return Math.max(0,opponentAway)-Math.max(0,ownAway);
  if(ownAway<1)return 1;
  if(opponentAway<1)return 0;
  if(ownAway>11||opponentAway>11)throw new Error('Original match equity table supports distances of at most 11');
  return MATCH_EQUITY_PERCENT[ownAway-1][opponentAway-1]*.01;
}
/** Native recube adjustment 0x425c50. Parameter order follows the binary. */
export function nativeRecubeAdjustment(ownAway,opponentAway,cube,mode=1) {
  if(!Number.isInteger(cube)||cube<1)throw new Error('Invalid cube value');
  if(opponentAway<=cube)return 0;
  const factor=ownAway>2*cube?.5:.75;
  const twice=opponentAway-2*cube;
  const numerator=nativeMatchEquity(ownAway,opponentAway-cube,mode)-nativeMatchEquity(ownAway,twice,mode);
  const denominator=nativeMatchEquity(ownAway-2*cube,opponentAway,mode)-nativeMatchEquity(ownAway,twice,mode);
  const ratio=numerator/denominator;
  return ratio<1?factor*ratio/(1-ratio):1;
}
