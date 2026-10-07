export const LEGACY = Object.freeze({width:768.24,height:1086.236,top:127.556,bottom:151.28,inner:114.089,outer:100.151});
export const DEFAULT_PAGE_SETTINGS = Object.freeze({mode:'silver',ratioWidth:1,ratioHeight:Math.SQRT2,top:LEGACY.top/LEGACY.height*100,bottom:LEGACY.bottom/LEGACY.height*100,inner:LEGACY.inner/LEGACY.width*100,outer:LEGACY.outer/LEGACY.width*100});
export function normalizePageSettings(value={}){
  const s={...DEFAULT_PAGE_SETTINGS,...value};
  if(!['silver','free'].includes(s.mode))throw new Error('アスペクト比を選んでください。');
  for(const key of ['ratioWidth','ratioHeight'])if(!Number.isFinite(s[key])||s[key]<=0||s[key]>10000)throw new Error('幅と高さは0より大きく、10000以下の数値にしてください。');
  const ratio=s.mode==='silver'?Math.SQRT2:s.ratioHeight/s.ratioWidth;
  if(ratio<0.5||ratio>2.5)throw new Error('フリーの高さ÷幅は0.5〜2.5にしてください。');
  for(const key of ['top','bottom','inner','outer'])if(!Number.isFinite(s[key])||s[key]<0||s[key]>45)throw new Error('余白はそれぞれ0〜45％にしてください。');
  if(s.top+s.bottom>80||s.inner+s.outer>80)throw new Error('向かい合う余白の合計は80％以内にしてください。');
  return s;
}
export function pageGeometry(value){
  const settings=normalizePageSettings(value),width=LEGACY.width,height=width*(settings.mode==='silver'?Math.SQRT2:settings.ratioHeight/settings.ratioWidth);
  const top=height*settings.top/100,bottom=height*(1-settings.bottom/100),inner=width*settings.inner/100,outer=width*settings.outer/100;
  const pitch=22.44,bodySize=22,linePitch=38;
  const rows=Math.floor((bottom-top-bodySize+1e-6)/pitch)+1,columns=Math.floor((width-inner-outer-bodySize+1e-6)/linePitch)+1;
  return {settings,width,height,top,bottom,inner,outer,pitch,bodySize,linePitch,rows,columns,oddRight:width-inner-bodySize/2,evenRight:width-outer-bodySize/2};
}
// Fixed editorial templates retain their composition; margin changes adjust their frame.
export function fitTemplate(doc,value,startSide='odd'){
  const g=pageGeometry(value),d=DEFAULT_PAGE_SETTINGS,s=g.settings;
  for(const [i,page] of doc.pages.entries()){
    const odd=(i+(startSide==='even'?1:0))%2===0;
    const blocks=[...page.cells.map(c=>({x:c.x,y:c.y,width:c.size,height:c.size})),...(page.images||[]),...(page.rules||[])];
    if(!blocks.length)continue;
    const left=Math.min(...blocks.map(b=>b.x)),right=Math.max(...blocks.map(b=>b.x+b.width)),top=Math.min(...blocks.map(b=>b.y)),bottom=Math.max(...blocks.map(b=>b.y+b.height));
    const x1=Math.max(0,left+g.width*((odd?s.outer:s.inner)-(odd?d.outer:d.inner))/100);
    const x2=Math.min(g.width,right-g.width*((odd?s.inner:s.outer)-(odd?d.inner:d.outer))/100);
    const y1=Math.max(0,top*g.height/LEGACY.height+g.height*(s.top-d.top)/100);
    const y2=Math.min(g.height,bottom*g.height/LEGACY.height-g.height*(s.bottom-d.bottom)/100);
    if(x2-x1<44||y2-y1<44||x1<0||x2>g.width||y1<0||y2>g.height)throw new Error('この目次・寄稿・あとがきの配置では余白をこれ以上変更できません。余白を初期値に近づけてください。');
    const scale=Math.min((x2-x1)/(right-left),(y2-y1)/(bottom-top));
    const dx=x1+(x2-x1-(right-left)*scale)/2,dy=y1+(y2-y1-(bottom-top)*scale)/2;
    for(const c of page.cells){c.x=dx+(c.x-left)*scale;c.y=dy+(c.y-top)*scale;c.size*=scale;}
    for(const b of [...(page.images||[]),...(page.rules||[])]){b.x=dx+(b.x-left)*scale;b.y=dy+(b.y-top)*scale;b.width*=scale;b.height*=scale;}
    Object.assign(page,{width:g.width,height:g.height,side:odd?'odd':'even'});
  }
  return doc;
}

export function applyPageSettings(items,{scope,selectedId,settings}){
  if(!['all','without-pdf','selected'].includes(scope))throw new Error('適用範囲を選んでください。');
  const value=normalizePageSettings(settings);
  const targets=items.filter(item=>scope==='all'||(scope==='without-pdf'?item.kind!=='pdf':item.id===selectedId));
  if(!targets.length)throw new Error('この範囲に適用できる項目がありません。');
  return items.map(item=>!targets.includes(item)?item:item.kind==='pdf'
    ? {...item,pdfRatio:{mode:value.mode,ratioWidth:value.ratioWidth,ratioHeight:value.ratioHeight}}
    : {...item,pageSettings:{...value}});
}
