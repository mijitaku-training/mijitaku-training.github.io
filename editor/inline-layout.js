import {pageGeometry} from './page-settings.js?v=21';
import {paginate,breakLines,withRuby,glyphRun,graphemes,bodyGeometry,sizedCell,lineInsets} from './layout.js?v=55';
export const placements=[['top-right','右上'],['top-left','左上'],['bottom-right','右下'],['bottom-left','左下'],['right','右半分'],['left','左半分'],['full','フルページ']];
export function cropPlacement(image,frame,crop={}){
  const zoom=Math.max(.1,Math.min(5,Number(crop.zoom)||1));
  const fit=crop.fit==='contain'?Math.min:Math.max;
  const scale=fit(frame.width/image.width,frame.height/image.height)*zoom;
  const width=image.width*scale,height=image.height*scale;
  const x=Math.max(0,Math.min(1,Number.isFinite(crop.x)?crop.x:.5)),y=Math.max(0,Math.min(1,Number.isFinite(crop.y)?crop.y:.5));
  return {x:frame.x-(width-frame.width)*x,y:frame.y-(height-frame.height)*y,width,height};
}
function caption(text,width,font,size=13){
  if(!text)return [];
  const lines=[];let line='',used=0;
  for(const c of graphemes(text)){
    const w=glyphRun(font,c,true).positions.reduce((n,p)=>n+p.xAdvance,0)*size/font.unitsPerEm;
    if(c==='\n'||used+w>width){lines.push(line);line='';used=0;if(c==='\n')continue;}
    line+=c;used+=w;
  }
  if(line)lines.push(line);return lines;
}
export function paginateWithImages(options){
  const pictures=options.inlineImages||[];
  if(!pictures.length)return paginate(options);
  const g=bodyGeometry(options.pageSettings,options.body),seed=paginate({...options,body:'あ',geometryBody:options.body}),header=seed.pages[0].cells.filter(c=>c.role!=='body');
  const pages=[],slots=[],frames=[],maxPage=Math.max(...pictures.map(p=>p.page));
  if(maxPage>300)throw new Error('画像のページは300以内にしてください。');
  if(new Set(pictures.map(p=>p.page)).size!==pictures.length)throw new Error('本文内画像は1ページに1枚です。ページ番号を分けてください。');
  let firstTextIndex=0;while(pictures.some(p=>p.page===firstTextIndex+1&&p.position==='full'))firstTextIndex++;
  function addPage(){
    const index=pages.length;if(index>=300)throw new Error('300ページ以内にしてください。');
    const odd=(index+(options.startSide==='even'?1:0))%2===0,right=odd?g.oddRight:g.evenRight;
    const page={index,width:g.width,height:g.height,side:odd?'odd':'even',cells:[],images:[]};pages.push(page);
    const pic=pictures.find(p=>p.page===index+1),reserve=index===firstTextIndex?seed.pages[0].offset:0;
    // On a full image first page the heading is moved to the next text page.
    if(index===firstTextIndex){const dx=right-(options.startSide==='even'?g.evenRight:g.oddRight);page.cells.push(...header.map(c=>({...c,x:c.x+dx})));}
    let box;
    if(pic){
      const full=pic.position==='full',half=['left','right'].includes(pic.position),left=pic.position.includes('left');
      const columns=g.columns-reserve;if(columns<4)throw new Error('画像を入れる本文幅が足りません。タイトルか余白を調整してください。');
      const xRight=right-reserve*g.linePitch+g.bodySize/2,xLeft=right-(g.columns-1)*g.linePitch-g.bodySize/2;
      const width=xRight-xLeft,height=(g.rows-1)*g.pitch+g.bodySize;
      const imageColumns=Math.floor(columns/2),blockWidth=(imageColumns-1)*g.linePitch+g.bodySize;
      box={x:full?xLeft:left?xLeft:xRight-blockWidth,y:g.top,width:full?width:blockWidth,height:full||half?height:Math.floor(g.rows/2)*g.pitch};
      if(pic.position.startsWith('bottom'))box.y=g.top+height-box.height;
      // Shape the image frame independently from its page placement.
      const slot={...box},ratio=pic.shape==='square'?1:pic.shape==='original'?pic.image.width/pic.image.height:null;
      let frameWidth=slot.width,above,below,upper,lower,frameHeight;
      for(let attempt=0;attempt<30;attempt++){
        above=caption(pic.above,frameWidth,options.font);below=caption(pic.below,frameWidth,options.font);
        upper=above.length?above.length*17+6:0;lower=below.length?below.length*17+6:0;
        const available=slot.height-upper-lower;
        if(available<44||frameWidth<44)throw new Error('画像枠が小さすぎます。注釈を短くするか配置・画像枠の形を変えてください。');
        frameHeight=ratio?frameWidth/ratio:available;
        if(frameHeight<=available+.001)break;
        frameWidth=available*ratio;
        if(attempt===29)throw new Error('注釈が長すぎます。短くするか配置を変えてください。');
      }
      const totalHeight=upper+frameHeight+lower;
      const x=full?slot.x+(slot.width-frameWidth)/2:left?slot.x:slot.x+slot.width-frameWidth;
      const y=full?slot.y+(slot.height-totalHeight)/2:pic.position.startsWith('bottom')?slot.y+slot.height-totalHeight:slot.y;
      const frame={x,y:y+upper,width:frameWidth,height:frameHeight};
      // Corner placements release the remaining space back to the manuscript.
      // Half-page placements continue reserving the selected half.
      if(!half&&!full)box={x,y,width:frameWidth,height:totalHeight};
      const position=cropPlacement(pic.image,frame,pic.crop);
      page.images.push({data:pic.image.data,...position,clip:frame});
      for(const [lines,captionY,align] of [[above,y,pic.aboveAlign],[below,frame.y+frame.height+6,pic.belowAlign]])lines.forEach((text,n)=>{
        const width=glyphRun(options.font,text,true).positions.reduce((sum,p)=>sum+p.xAdvance,0)*13/options.font.unitsPerEm;
        const space=Math.max(0,frame.width-width),shift=align==='right'?space:align==='center'?space/2:0;
        page.cells.push({char:text,source:text,kind:'caption',role:'caption',x:frame.x+shift,y:captionY+n*17,size:13});
      });
    }
    frames.push({page,right,reserve,box,full:pic?.position==='full',previous:null});
  }
  let pageIndex=0,pending=null;
  function locate(inset){
    while(true){
      if(!frames[pageIndex])addPage();
      const frame=frames[pageIndex];
      if(frame.full){pageIndex++;continue;}
      const {page,right,reserve,box,previous}=frame;
      let centre=previous?previous.centre-g.linePitch-previous.inset.left-inset.right:right-reserve*g.linePitch-inset.right;
      const left=right-(g.columns-1)*g.linePitch-g.bodySize/2;
      while(centre-g.bodySize/2-inset.left>=left-1e-6){
        const x=centre-g.bodySize/2;let top=g.top,rows=g.rows;
        if(box&&x-inset.left<box.x+box.width&&x+g.bodySize+inset.right>box.x){
          if(box.y<=g.top+.1){top=box.y+box.height+g.pitch*.5;rows=Math.floor((g.bottom-top-g.bodySize)/g.pitch)+1;}
          else rows=Math.floor((box.y-g.pitch*.5-g.top-g.bodySize)/g.pitch)+1;
        }
        if(rows>0)return {page,frame,x,centre,top,rows,inset};
        centre-=g.linePitch;
      }
      pageIndex++;
    }
  }
  const getSlot=n=>slots[n]||pending||(pending=locate({left:0,right:0}));
  const acceptLine=(line,n)=>{
    const before=getSlot(n),actual=lineInsets(line,g.bodySize);
    // Widen monotonically if a new image boundary makes us wrap again.
    const inset={left:Math.max(before.inset.left,actual.left),right:Math.max(before.inset.right,actual.right)};
    const next=locate(inset);pending=next;
    if(next.rows!==before.rows)return false;
    slots[n]=next;next.frame.previous=next;pending=null;return true;
  };
  const lines=breakLines(options.body,options.indent,options.combineDigits,g.rows,{font:options.font,size:g.bodySize,pitch:g.pitch,autoPunctuationSpace:options.autoPunctuationSpace,lineRows:n=>getSlot(n).rows,acceptLine});
  lines.forEach((line,n)=>{const slot=slots[n];for(const u of line)slot.page.cells.push({char:u.display,source:u.text,kind:u.kind,italic:u.italic,ruby:u.ruby,rubyIndex:u.rubyIndex,x:slot.x,y:slot.top+u.rowOffset*g.pitch,...sizedCell(u,g.bodySize,slot.x),role:'body'});});
  // A picture may be placed on the page directly following the text.
  while(pages.length<maxPage){if(pages.length+1<maxPage&&!pictures.some(p=>p.page===pages.length+1))throw new Error('指定ページまで本文がありません。画像のページ番号を小さくしてください。');addPage();}
  // Header has already passed through withRuby in the seed.
  for(const page of pages){const fixed=page.cells.filter(c=>c.role!=='body');page.cells=page.cells.filter(c=>c.role==='body');withRuby([page],options.font);page.cells.push(...fixed);}
  return {...seed,pages,body:options.body};
}




