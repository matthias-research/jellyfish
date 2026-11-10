export const MOTION_DEFAULTS = Object.freeze({dicePauseMs:1000,animationMs:350});
export function motionSettings(settings={}) {
  const value=(key,max)=>Number.isFinite(settings[key])&&settings[key]>=0&&settings[key]<=max?settings[key]:MOTION_DEFAULTS[key];
  return {dicePauseMs:value('dicePauseMs',5000),animationMs:value('animationMs',1500)};
}
/** Logical checker locations to the same SVG coordinates used by the board. */
export function checkerPosition(location,player,count,flip=false) {
  if(location===-1)return {x:472,y:(player===1?430:200)+Math.min(2,Math.max(0,count-1))*28,scaleY:1};
  if(location===24)return {x:962,y:player===1?640-(count-1)*13:41+(count-1)*13,scaleY:.2};
  const visual=flip?23-location:location,top=visual>=12,col=top?visual-12:11-visual;
  return {x:59+col*70+(col>=6?56:0),y:top?60+Math.min(4,Math.max(0,count-1))*49:620-Math.min(4,Math.max(0,count-1))*49,scaleY:1};
}
export function interpolateChecker(from,to,t) {
  const eased=t*t*(3-2*t);
  return {x:from.x+(to.x-from.x)*eased,y:from.y+(to.y-from.y)*eased,scaleY:from.scaleY+(to.scaleY-from.scaleY)*eased};
}
/** Finishes promptly after cancellation without mutating application state. */
export function animateChecker(from,to,duration,update,isCurrent) {
  return new Promise(resolve=>{
    let start;
    function frame(now){
      if(!isCurrent()){resolve(false);return;}
      start??=now;
      const t=duration===0?1:Math.min(1,(now-start)/duration);
      update(interpolateChecker(from,to,t));
      if(t===1)resolve(true);else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
