export const THEMES = {
  maple:{name:'Maple Garden',description:'Light maple · coral & sage',colors:{felt:'#dfbf83',light:'#7b9d65',dark:'#db705d',frame:'#c6a16c',tray:'#ae8957',edge:'#896e43',ink:'#463723',grain:'#795125',white:'#fff9e6',black:'#302f36',surface:'#eddbb6',page:'#c9b48f',accent:'#314d6b',muted:'#6f6049',header:'#e4cea5'}},
  walnut:{name:'Walnut & Gold',description:'Warm walnut · blue & gold',colors:{felt:'#805b3c',light:'#4e86ab',dark:'#e1ba4f',frame:'#68482f',tray:'#513821',edge:'#422d20',ink:'#f5e4be',grain:'#321b10',white:'#fff4d5',black:'#29252d',surface:'#8b6847',page:'#30251f',accent:'#382f3b',muted:'#ead7b8',header:'#705036'}},
  meadow:{name:'Meadow Bloom',description:'Pale ash · sky & leaf',colors:{felt:'#ebd9ad',light:'#6d9d64',dark:'#5c94b0',frame:'#d6bc8e',tray:'#bca174',edge:'#a58b60',ink:'#443a2c',grain:'#92764c',white:'#fffbed',black:'#33303b',surface:'#f0e1c3',page:'#c9bca1',accent:'#6d7656',muted:'#72664f',header:'#e4d2af'}},
  heritage:{name:'Heritage Mahogany',description:'Golden wood · silver & ruby',colors:{felt:'#e5aa4d',light:'#b96e27',dark:'#652408',frame:'#582608',tray:'#3b1606',edge:'#391706',ink:'#ffe6bc',grain:'#88400c',white:'#e8e9e7',black:'#cf0006',surface:'#694024',page:'#164416',accent:'#762217',muted:'#e7c9a1',header:'#48250f'}},
  classic:{name:'Classic',description:'Muted traditional colors · dark controls',colors:{felt:'#19661a',light:'#cbcd32',dark:'#cd3432',frame:'#794d1d',tray:'#523414',edge:'#111',ink:'#fff',grain:'#964b00',white:'#fff',black:'#111',surface:'#252429',page:'#18171c',accent:'#c4a5ff',muted:'#b2aebc',header:'#180d30'}}
};
export const themeName=value=>Object.hasOwn(THEMES,value)?value:'walnut';
export function applyTheme(value){
  const id=themeName(value);document.documentElement.dataset.theme=id;
  for(const [key,color] of Object.entries(THEMES[id].colors))document.documentElement.style.setProperty('--'+key,color);
}
