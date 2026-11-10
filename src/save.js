import {themeName} from './themes.js';
import {MOTION_DEFAULTS} from './animation.js';
import {validateBoard,cloneBoard,legalTurns,applyMove,winner,winMultiplier,initialBoard} from './rules.js';
const fail=message=>{throw new Error(message);};
const sameBoard=(a,b)=>['points','bar','off'].every(k=>a[k].every((n,i)=>n===b[k][i]));
const sameMove=(a,b)=>a&&b&&a.from===b.from&&a.to===b.to&&a.die===b.die;
const player=p=>p===1||p===-1;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
/** Parse/validate untrusted browser saves before replacing any live state.
 * Returns only known fields, with fresh arrays and canonical move metadata.
 */
export function validateSave(d) {
  if(!d||d.format!=='jellyfish-web'||d.version!==1)fail('This is not a supported JellyFish browser save.');
  validateBoard(d.board);
  if(d.board.off.every(n=>n===15))fail('Both players cannot have won.');
  if(!player(d.player)||!Array.isArray(d.dice)||![0,2].includes(d.dice.length)||d.dice.some(n=>!Number.isInteger(n)||n<1||n>6)||!Array.isArray(d.prefix)||d.prefix.length>4||typeof d.opening!=='boolean')fail('Invalid turn state.');
  const s=d.settings,m=d.match;
  for(const [key,max] of [['dicePauseMs',5000],['animationMs',1500]])if(s&&s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<0||s[key]>max))fail('Invalid animation settings.');
  if(!s||!['human','computer'].includes(s.opponent)||![1,2,3,4,5,6,7].includes(Number(s.level))||!integer(Number(s.target))||Number(s.target)>10000||typeof s.flip!=='boolean')fail('Invalid settings.');
  if(!m||!Array.isArray(m.scores)||m.scores.length!==2||!m.scores.every(integer)||!integer(m.target)||m.target>10000||!integer(m.game)||m.game<1||!Number.isSafeInteger(m.cube)||m.cube<1||m.cube>2**30||!Number.isInteger(Math.log2(m.cube))||![null,1,-1].includes(m.cubeOwner)||![null,1,-1].includes(m.pendingDouble)||![null,1,-1].includes(m.matchWinner)||typeof m.crawford!=='boolean'||typeof m.crawfordUsed!=='boolean')fail('Invalid match metadata.');
  if(m.pendingDouble!==null)fail('Finish the cube decision before saving or loading.');
  if((m.cube===1)!==(m.cubeOwner===null))fail('Invalid cube ownership.');
  if(m.crawford&&(m.crawfordUsed||m.target===0||m.cube!==1))fail('Invalid Crawford state.');
  if(m.target===0&&(m.crawfordUsed||m.matchWinner!==null))fail('Invalid money-game state.');
  if(!Array.isArray(d.history)||d.history.length>100000||!d.history.every(x=>typeof x==='string'&&x.length<=10000))fail('Invalid game history.');
  if(d.history.reduce((n,s)=>n+s.length,0)>8000000)fail('Game history is too large.');
  let result=null;
  if(m.result!==null) {
    const r=m.result;
    if(!r||!player(r.winner)||![1,2,3].includes(r.multiplier)||!['bearoff','drop','resignation'].includes(r.reason)||r.points!==m.cube*r.multiplier||m.scores[r.winner===1?0:1]<r.points)fail('Invalid game result.');
    if(r.reason==='drop'&&r.multiplier!==1)fail('Invalid dropped-cube result.');
    if(r.reason==='bearoff'&&(winner(d.board)!==r.winner||winMultiplier(d.board,r.winner)!==r.multiplier))fail('Result does not match the board.');
    result={winner:r.winner,points:r.points,multiplier:r.multiplier,reason:r.reason};
    if(d.dice.length||d.opening)fail('A finished game cannot have an active turn.');
  } else if(m.matchWinner!==null)fail('A match winner requires a completed game.');
  const reached=m.target?m.scores.map(n=>n>=m.target):[false,false];
  if(reached.every(Boolean)||reached.some(Boolean)!==(m.matchWinner!==null)||(m.matchWinner!==null&&(!reached[m.matchWinner===1?0:1]||result?.winner!==m.matchWinner)))fail('Match winner does not match the score.');
  let turnStart=cloneBoard(d.board),prefix=[];
  if(d.dice.length) {
    validateBoard(d.turnStart);
    if(winner(d.turnStart)||d.opening||result)fail('Invalid start of turn.');
    const legal=legalTurns(d.turnStart,d.player,d.dice).find(t=>d.prefix.every((move,i)=>sameMove(move,t.moves[i])));
    if(!legal)fail('Saved moves do not form a legal turn.');
    let replay=cloneBoard(d.turnStart);
    prefix=legal.moves.slice(0,d.prefix.length).map(m=>({...m}));
    for(const move of prefix)replay=applyMove(replay,d.player,move);
    if(!sameBoard(replay,d.board))fail('Board does not match saved moves.');
    turnStart=cloneBoard(d.turnStart);
  } else if(!result&&d.prefix.length)fail('Moves require dice.');
  if(d.opening&&(!sameBoard(d.board,initialBoard())||m.cube!==1||d.dice.length))fail('Invalid opening position.');
  if(!result&&!d.dice.length&&winner(d.board))fail('Winning board requires a completed game.');
  return {format:'jellyfish-web',version:1,board:cloneBoard(d.board),match:{target:m.target,scores:[...m.scores],game:m.game,cube:m.cube,cubeOwner:m.cubeOwner,crawford:m.crawford,crawfordUsed:m.crawfordUsed,pendingDouble:null,result,matchWinner:m.matchWinner},player:d.player,dice:[...d.dice],prefix,turnStart,opening:d.opening,history:[...d.history],settings:{playMode:s.playMode==='jellyfish'?'jellyfish':'destinations',theme:themeName(s.theme),opponent:s.opponent,target:Number(s.target),level:Number(s.level),flip:s.flip,confirm:s.confirm!==false,dicePauseMs:s.dicePauseMs??MOTION_DEFAULTS.dicePauseMs,animationMs:s.animationMs??MOTION_DEFAULTS.animationMs}};
}
