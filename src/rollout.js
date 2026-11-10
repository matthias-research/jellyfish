import {cloneBoard,rollDice,winner,winMultiplier} from './rules.js';
import {chooseTurn} from './ai.js';
/** Seeded cubeless rollout using the recovered direct evaluator for both sides. */
export function rollout(board,player,{games=16,seed=1,maxTurns=1000}={}) {
  if(!Number.isInteger(games)||games<1||games>128||!Number.isInteger(maxTurns)||maxTurns<1||maxTurns>2000)throw Error('Invalid rollout limits');
  let state=seed>>>0,wins=0,losses=0,unfinished=0,total=0,squares=0;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  for(let game=0;game<games;game++){
    let b=cloneBoard(board),side=player,turn=0;
    while(!winner(b)&&turn++<maxTurns){const choice=chooseTurn(b,side,rollDice(random),{level:5});b=choice.board;side=-side;}
    const won=winner(b);
    if(!won){unfinished++;continue;}
    const score=(won===player?1:-1)*winMultiplier(b,won);
    if(won===player)wins++;else losses++;
    total+=score;squares+=score*score;
  }
  const count=wins+losses,mean=count?total/count:null;
  return {games,wins,losses,unfinished,winRate:count?wins/count:null,equity:mean,standardError:count>1?Math.sqrt(Math.max(0,(squares-total*total/count)/(count-1))/count):null,seed:seed>>>0,source:'seeded cubeless rollout, direct evaluator for both players'};
}
