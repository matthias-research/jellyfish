export const THEMES = {
  maple:{name:'Maple Garden',description:'Light maple · coral & sage',colors:{highlight:'#667b49',felt:'#dfbf83',light:'#7b9d65',dark:'#db705d',frame:'#c6a16c',tray:'#ae8957',edge:'#896e43',ink:'#463723',grain:'#795125',white:'#fff9e6',black:'#302f36'}},
  walnut:{name:'Walnut & Gold',description:'Warm walnut · blue & gold',colors:{highlight:'#ebd494',felt:'#805b3c',light:'#4e86ab',dark:'#e1ba4f',frame:'#68482f',tray:'#513821',edge:'#422d20',ink:'#f5e4be',grain:'#321b10',white:'#fff4d5',black:'#29252d'}},
  meadow:{name:'Meadow Bloom',description:'Pale ash · sky & leaf',colors:{highlight:'#476d7a',felt:'#ebd9ad',light:'#6d9d64',dark:'#5c94b0',frame:'#d6bc8e',tray:'#bca174',edge:'#a58b60',ink:'#443a2c',grain:'#92764c',white:'#fffbed',black:'#33303b'}},
  heritage:{name:'Heritage Mahogany',description:'Golden wood · silver & ruby',colors:{highlight:'#e6c65b',felt:'#e5aa4d',light:'#b96e27',dark:'#652408',frame:'#582608',tray:'#3b1606',edge:'#391706',ink:'#ffe6bc',grain:'#88400c',white:'#e8e9e7',black:'#cf0006'}},
  classic:{name:'Classic',description:'Muted green · red & yellow',colors:{highlight:'#ebdeb0',felt:'#19661a',light:'#cbcd32',dark:'#cd3432',frame:'#794d1d',tray:'#523414',edge:'#111',ink:'#fff',grain:'#964b00',white:'#fff',black:'#111'}}
};
export const themeName=value=>Object.hasOwn(THEMES,value)?value:'walnut';
export function applyTheme(value){
  const id=themeName(value);document.documentElement.dataset.theme=id;
  for(const [key,color] of Object.entries(THEMES[id].colors))document.documentElement.style.setProperty('--'+key,color);
}
