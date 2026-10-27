import {placements,cropPlacement} from './inline-layout.js?v=51';
import {readImageFile} from './book.js?v=51';
export function createInlineEditor({host,getItem,changed,getFrame,isBusy}){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const heading=make('h3','本文内の画像'),help=make('p','作品内のページ番号を指定します。1ページに1枚。画像の上下に横書きの注釈を付けられます。'),add=make('button','＋ 本文内に画像を追加'),file=make('input'),list=make('div');
 add.type='button';file.type='file';file.accept='image/*';file.hidden=true;host.append(heading,help,add,file,list);
 add.onclick=()=>{if(!isBusy()){file.value='';file.click();}};
 file.onchange=async()=>{const selected=file.files[0],item=getItem();if(!selected||!item||isBusy())return;add.disabled=true;try{const image=await readImageFile(selected);item.inlineImages ||= [];if(item.inlineImages.length>=20)throw Error('1作品20枚までです。');let page=1;while(item.inlineImages.some(p=>p.page===page))page++;item.inlineImages.push({id:crypto.randomUUID(),page,position:'top-right',shape:'original',above:'',below:'',crop:{zoom:1,x:.5,y:.5,fit:'contain'},image});changed();render();}catch(e){alert(e.message);}finally{add.disabled=false;}};
 let observers=[];
 function render(){
  observers.forEach(o=>o.disconnect());observers=[];
  const item=getItem();host.hidden=item?.kind!=='text'||!!item.layout;host.parentElement.hidden=host.hidden;list.replaceChildren();if(host.hidden)return;
  for(const pic of item.inlineImages||[]){
   const card=make('section');card.className='inline-card';const title=make('h4',pic.image.name);card.append(title);
   const field=(label,input)=>{const l=make('label',label);l.append(input);card.append(l);return input;};
   const page=field('作品内のページ',make('input'));page.type='number';page.min=1;page.max=300;page.value=pic.page;
   const position=field('配置',make('select'));for(const [value,label] of placements){const o=make('option',label);o.value=value;position.append(o);}position.value=pic.position;
   const shape=field('画像枠の形',make('select'));for(const [value,label] of [['frame','配置に合わせる'],['square','正方形（1：1）'],['original','元画像の比率']]){const o=make('option',label);o.value=value;shape.append(o);}shape.value=pic.shape||'frame';
   const fit=field('画像の収め方',make('select'));for(const [value,label] of [['contain','画像全体を収める（切らない）'],['cover','枠いっぱいにする（トリミング）']]){const o=make('option',label);o.value=value;fit.append(o);}fit.value=pic.crop.fit||'cover';
   const above=field('画像の上の注釈',make('textarea')),below=field('画像の下の注釈',make('textarea'));above.value=pic.above;below.value=pic.below;above.maxLength=below.maxLength=200;above.rows=below.rows=2;
   const stage=make('div');stage.className='inline-crop';stage.style.background='#fff';stage.style.outline='1px solid #bbc4d3';stage.setAttribute('aria-label','画像のトリミング。ドラッグで位置を調整');const image=make('img');image.src=pic.image.data;image.alt='トリミング対象';image.draggable=false;stage.append(image);card.append(stage);
   const zoom=field('拡大・縮小',make('input'));zoom.type='range';zoom.min=.1;zoom.max=5;zoom.step=.01;zoom.value=pic.crop.zoom;const zoomLabel=make('output');zoomLabel.setAttribute('aria-live','polite');card.append(zoomLabel);
   const horizontal=field('左右の位置',make('input')),vertical=field('上下の位置',make('input'));for(const input of [horizontal,vertical]){input.type='range';input.min=0;input.max=1;input.step=.005;}
   const note=make('p','枠内が誌面に出る範囲です。ドラッグ・ピンチ、またはスライダーで調整できます。全体を収める場合は100％以下にしてください。余った部分は白になります。');card.append(note);
   let frame={width:250,height:350},pointers=new Map(),gesture=null;
   function draw(){const w=stage.clientWidth||280,h=w*frame.height/frame.width;stage.style.height=h+'px';const p=cropPlacement(pic.image,{x:0,y:0,width:w,height:h},pic.crop);Object.assign(image.style,{left:p.x+'px',top:p.y+'px',width:p.width+'px',height:p.height+'px'});zoom.value=pic.crop.zoom;zoomLabel.textContent=Math.round(pic.crop.zoom*100)+'％';horizontal.value=pic.crop.x;vertical.value=pic.crop.y;}
   function refresh(){try{frame=getFrame(pic)||frame;note.textContent='枠内が誌面に出る範囲です。ドラッグ・ピンチ、またはスライダーで調整できます。全体を収める場合は100％以下にしてください。余った部分は白になります。';}catch(e){note.textContent=e.message;}draw();}
   page.onchange=()=>{const value=Number(page.value);if(!Number.isInteger(value)||value<1||value>300){page.value=pic.page;return;}pic.page=value;changed();refresh();};
   shape.onchange=()=>{pic.shape=shape.value;pic.crop={zoom:1,x:.5,y:.5,fit:fit.value};changed();refresh();};
   fit.onchange=()=>{pic.crop={zoom:1,x:.5,y:.5,fit:fit.value};changed();refresh();};
   position.onchange=()=>{pic.position=position.value;changed();refresh();};
   for(const [input,key] of [[above,'above'],[below,'below']])input.oninput=()=>{pic[key]=input.value;changed();refresh();};
   for(const [input,key] of [[zoom,'zoom'],[horizontal,'x'],[vertical,'y']])input.oninput=()=>{pic.crop[key]=Number(input.value);draw();changed();};
   function start(){const ps=[...pointers.values()];gesture={crop:{...pic.crop},center:{x:ps.reduce((n,p)=>n+p.x,0)/ps.length,y:ps.reduce((n,p)=>n+p.y,0)/ps.length},distance:ps.length===2?Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y):0};}
   stage.onpointerdown=e=>{if(isBusy())return;stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});start();};
   stage.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=[...pointers.values()],center={x:ps.reduce((n,p)=>n+p.x,0)/ps.length,y:ps.reduce((n,p)=>n+p.y,0)/ps.length};if(ps.length===2&&gesture.distance)pic.crop.zoom=Math.max(.1,Math.min(5,gesture.crop.zoom*Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)/gesture.distance));const w=stage.clientWidth,h=stage.clientHeight,p=cropPlacement(pic.image,{x:0,y:0,width:w,height:h},pic.crop);const pan=(start,delta,space)=>Math.abs(space)<1?start:Math.max(0,Math.min(1,start+delta/space));pic.crop.x=pan(gesture.crop.x,center.x-gesture.center.x,w-p.width);pic.crop.y=pan(gesture.crop.y,center.y-gesture.center.y,h-p.height);draw();};
   stage.onpointerup=stage.onpointercancel=e=>{pointers.delete(e.pointerId);if(pointers.size)start();changed();};
   const reset=make('button','トリミングをリセット'),remove=make('button','この画像を削除');reset.type=remove.type='button';reset.onclick=()=>{pic.crop={zoom:1,x:.5,y:.5,fit:fit.value};draw();changed();};remove.onclick=()=>{if(isBusy())return;item.inlineImages=item.inlineImages.filter(p=>p!==pic);changed();render();};card.append(reset,remove);list.append(card);refresh();
   const observer=new ResizeObserver(draw);observer.observe(stage);observers.push(observer);
  }
 }
 return {render};
}

