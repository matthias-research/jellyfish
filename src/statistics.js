/** Statistics of recorded browser-game events, including only retained log history. */
export function recordedStatistics(history) {
  const sides=[0,1].map(()=>({rolls:0,doubles:0,diceTotal:0,turns:0,moves:0,hits:0,passes:0}));
  for(const line of history){
    const roll=/^(You|JellyFish|Player 2) rolls ([1-6])[\u2013-]([1-6])\.$/.exec(line);
    if(roll){const s=sides[roll[1]==='You'?0:1],a=Number(roll[2]),b=Number(roll[3]);s.rolls++;s.diceTotal+=a+b;if(a===b)s.doubles++;continue;}
    const turn=/^(You|JellyFish|Player 2): (.*)\.$/.exec(line);
    if(turn){const s=sides[turn[1]==='You'?0:1];s.turns++;if(turn[2]==='cannot move')s.passes++;else{const moves=turn[2].match(/(?:bar|\d+)\/(?:off|\d+)\*?/g)||[];s.moves+=moves.length;s.hits+=moves.filter(m=>m.endsWith('*')).length;}}
  }
  return sides.map(s=>({...s,averageDie:s.rolls?s.diceTotal/(s.rolls*2):null}));
}
