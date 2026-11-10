/** Pure backgammon rules. Players are +1 (white) and -1 (black).
 * points[0..23] hold signed checker counts. White travels 23 → 0.
 * bar/off arrays use white index 0, black index 1. Move bar=-1, off=24.
 * All public operations return fresh state and leave their input unchanged.
 */
export const BAR = -1;
export const OFF = 24;
export const playerIndex = player => { if(player !== 1 && player !== -1) throw new Error('Invalid player'); return player === 1 ? 0 : 1; };
export function initialBoard() {
  const points = Array(24).fill(0);
  for(const [p,n] of [[23,2],[12,5],[7,3],[5,5]]) points[p]=n;
  for(const [p,n] of [[0,2],[11,5],[16,3],[18,5]]) points[p]=-n;
  return {points,bar:[0,0],off:[0,0]};
}
export function cloneBoard(b) { return {points:[...b.points],bar:[...b.bar],off:[...b.off]}; }
export function validateBoard(b) {
  if(!b || b.points?.length!==24 || b.bar?.length!==2 || b.off?.length!==2) throw new Error('Invalid board shape');
  if(!b.points.every(n=>Number.isInteger(n)&&Math.abs(n)<=15) || ![...b.bar,...b.off].every(n=>Number.isInteger(n)&&n>=0&&n<=15)) throw new Error('Invalid checker count');
  for(const p of [1,-1]) if(b.points.reduce((n,v)=>n+Math.max(0,v*p),0)+b.bar[playerIndex(p)]+b.off[playerIndex(p)]!==15) throw new Error('Each player must have 15 checkers');
  return true;
}
export function pipCount(b,p) { return b.bar[playerIndex(p)]*25+b.points.reduce((sum,n,i)=>sum+Math.max(0,n*p)*(p===1?i+1:24-i),0); }
export function winner(b) { return b.off[0]===15?1:b.off[1]===15?-1:null; }
export function winMultiplier(b,p=winner(b)) {
  if(p===null) return 0;
  const loser=playerIndex(-p);
  if(b.off[loser]>0) return 1;
  const inWinnerHome=b.points.some((n,i)=>n*p<0 && (p===1?i<6:i>=18));
  return b.bar[loser]>0 || inWinnerHome?3:2;
}
function singleMoves(b,p,die) {
  const ix=playerIndex(p);
  if(!Number.isInteger(die)||die<1||die>6) throw new Error('Dice must be integers from 1 to 6');
  if(winner(b)) return [];
  if(b.bar[ix]) {
    const to=p===1?24-die:die-1;
    return b.points[to]*p>=-1?[{from:BAR,to,die,hit:b.points[to]*p===-1}]:[];
  }
  const allHome=!b.points.some((n,i)=>n*p>0 && (p===1?i>=6:i<18));
  const moves=[];
  for(let from=0;from<24;from++) {
    if(b.points[from]*p<=0) continue;
    const to=from-p*die;
    if(to>=0&&to<24) {
      if(b.points[to]*p>=-1) moves.push({from,to,die,hit:b.points[to]*p===-1});
    } else if(allHome) {
      const distance=p===1?from+1:24-from;
      const farther=b.points.some((n,i)=>n*p>0 && (p===1?i>from:i<from));
      if(die===distance || (die>distance&&!farther)) moves.push({from,to:OFF,die,hit:false});
    }
  }
  return moves;
}
function applyUnchecked(b,p,m) {
  const next=cloneBoard(b),ix=playerIndex(p);
  if(m.from===BAR) next.bar[ix]--; else next.points[m.from]-=p;
  if(m.to===OFF) next.off[ix]++;
  else { if(next.points[m.to]===-p) {next.points[m.to]=0;next.bar[1-ix]++;} next.points[m.to]+=p; }
  return next;
}
/** Validates a single step. For complete-turn dice constraints use legalTurns. */
export function applyMove(b,p,m) {
  const legal=singleMoves(b,p,m.die).find(x=>x.from===m.from&&x.to===m.to);
  if(!legal) throw new Error('Illegal checker move');
  return applyUnchecked(b,p,legal);
}
/** Complete legal move sequences. A forced pass is [{moves:[],board:copy}]. */
export function legalTurns(b,p,dice) {
  playerIndex(p);
  if(dice.length!==2||dice.some(d=>!Number.isInteger(d)||d<1||d>6)) throw new Error('Two valid dice are required');
  const orders=dice[0]===dice[1]?[[dice[0],dice[0],dice[0],dice[0]]]:[dice,[dice[1],dice[0]]];
  const turns=[];
  function visit(board,order,at,moves) {
    if(at===order.length||winner(board)) {turns.push({moves,board});return;}
    const steps=singleMoves(board,p,order[at]);
    if(!steps.length) visit(board,order,at+1,moves);
    else for(const m of steps) visit(applyUnchecked(board,p,m),order,at+1,[...moves,m]);
  }
  for(const order of orders) visit(cloneBoard(b),order,0,[]);
  const count=Math.max(...turns.map(t=>t.moves.length));
  let legal=turns.filter(t=>t.moves.length===count);
  if(count===1&&dice[0]!==dice[1]) {
    const higher=Math.max(...legal.map(t=>t.moves[0].die));
    legal=legal.filter(t=>t.moves[0].die===higher);
  }
  const seen=new Set();
  return legal.filter(t=>{const key=t.moves.map(m=>`${m.from}/${m.to}/${m.die}`).join(';');if(seen.has(key))return false;seen.add(key);return true;});
}
/** target=0 is unlimited money play; Crawford applies only to match play. */
export function createMatch(target=7) {
  if(!Number.isInteger(target)||target<0) throw new Error('Invalid match length');
  return {target,scores:[0,0],game:1,cube:1,cubeOwner:null,crawford:target===1,crawfordUsed:false,pendingDouble:null,result:null,matchWinner:null};
}
function copyMatch(m) { return {...m,scores:[...m.scores]}; }
export function canDouble(m,p) {playerIndex(p);return !m.result&&!m.matchWinner&&!m.crawford&&m.pendingDouble===null&&(m.cubeOwner===null||m.cubeOwner===p);}
/** Caller must offer before rolling, on the offerer's own turn. */
export function offerDouble(m,p) {
  if(!canDouble(m,p)) throw new Error('Doubling is unavailable');
  return {...copyMatch(m),pendingDouble:p};
}
function award(m,p,multiplier,reason) {
  if(m.result||m.matchWinner) throw new Error('Game is already finished');
  const next=copyMatch(m),points=m.cube*multiplier;
  next.scores[playerIndex(p)]+=points;
  next.result={winner:p,points,multiplier,reason};next.pendingDouble=null;
  if(next.target&&next.scores[playerIndex(p)]>=next.target) next.matchWinner=p;
  return next;
}
export function respondDouble(m,accept) {
  if(m.pendingDouble===null) throw new Error('No double is pending');
  if(!accept) return award(m,m.pendingDouble,1,'drop');
  return {...copyMatch(m),cube:m.cube*2,cubeOwner:-m.pendingDouble,pendingDouble:null};
}
export function finishGame(m,b) {
  const p=winner(b);
  if(p===null) throw new Error('Game is not finished');
  return award(m,p,winMultiplier(b,p),'bearoff');
}
/** Agreement to a resignation must be obtained by the interface before calling. */
export function resignGame(m,player,multiplier=1) {
  playerIndex(player);
  if(![1,2,3].includes(multiplier)) throw new Error('Invalid resignation value');
  return award(m,-player,multiplier,'resignation');
}
export function startGame(m) {
  if(!m.result||m.matchWinner) throw new Error('Cannot start another game');
  const used=m.crawfordUsed||m.crawford;
  return {...copyMatch(m),game:m.game+1,cube:1,cubeOwner:null,pendingDouble:null,result:null,crawfordUsed:used,crawford:!!m.target&&!used&&m.scores.some(s=>s===m.target-1)};
}
export function rollDice(random=Math.random) { return [1+Math.floor(random()*6),1+Math.floor(random()*6)]; }
/** Opening dice belong to white then black. A tie returns player:null. */
export function openingRoll(random=Math.random) {const dice=rollDice(random);return {dice,player:dice[0]===dice[1]?null:dice[0]>dice[1]?1:-1};}
