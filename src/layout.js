export function setupLayout(notice=()=>{}){
  const $=selector=>document.querySelector(selector);
  const rail=$('.horizontal-controls');
  function layout(active){
    document.body.classList.toggle('board-horizontal',active);
    rail.hidden=!active;
    $('#evaluation-bar').setAttribute('aria-orientation',active?'vertical':'horizontal');
    if(!active)$('#horizontal-layout').focus();
  }
  $('#horizontal-layout').onclick=()=>layout(true);
  async function leaveFullscreen(){
    if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}
  }
  $('#vertical-layout').onclick=()=>{layout(false);void leaveFullscreen();};
  const fullscreenButton=$('#toggle-fullscreen');
  function fullscreenChanged(){
    const active=!!document.fullscreenElement;
    fullscreenButton.textContent=active?'Windowed':'Fullscreen';
    fullscreenButton.setAttribute('aria-pressed',String(active));
  }
  document.addEventListener('fullscreenchange',fullscreenChanged);
  fullscreenButton.onclick=async()=>{
    if(document.fullscreenElement){await leaveFullscreen();return;}
    if(!document.fullscreenEnabled||!document.documentElement.requestFullscreen){
      notice('Fullscreen is not supported by this browser. You can continue using the Horizontal layout.');return;
    }
    try{
      await document.documentElement.requestFullscreen({navigationUI:'hide'});
      if(!document.body.classList.contains('board-horizontal'))await leaveFullscreen();
    }catch{notice('Could not enter fullscreen. You can try again or continue using the Horizontal layout.');}
  };
  fullscreenChanged();
  function sync(){
    for(const [side,label] of [['human','You'],['computer',$('#computer-name').textContent]]){
      const score=$(`#${side}-score`).textContent,pips=$(`#${side}-pips`).textContent.replace('Pips: ','');
      const target=$(`#compact-${side}`);
      target.replaceChildren(Object.assign(document.createElement('strong'),{textContent:score}),document.createTextNode(', '+pips));
      target.setAttribute('aria-label',`${label}: ${score} points, ${pips} pips`);
    }
    for(const action of ['double','undo','hint'])$(`#compact-${action}`).disabled=$(`#${action}`).disabled;
    const source=$('#move-rank'),quality=source.dataset.quality;
    for(const target of [$('#compact-quality'),$('#vertical-quality')]){
    target.textContent=quality?(Number(source.dataset.loss)===0?'0.000':'−'+source.dataset.loss):'';
    target.dataset.quality=quality||'';
    target.title=quality?source.textContent:'';
    target.setAttribute('aria-label',quality?source.textContent:'Move assessment');
    }
  }
  const observer=new MutationObserver(sync);
  for(const selector of ['.scoreboard','#move-rank','#double','#undo','#hint'])observer.observe($(selector),{subtree:true,childList:true,characterData:true,attributes:true});
  sync();
}
