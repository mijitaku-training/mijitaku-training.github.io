import {pageGeometry,fitTemplate} from './page-settings.js?v=21';
import {readerLogo} from './reader-logo.js?v=23';
export const SPEC = Object.freeze({width:768.24,height:768.24*Math.SQRT2,rows:36,columns:15,bodySize:22,titleSize:26,pitch:22.44,linePitch:38,top:127.556,oddRight:643.151,evenRight:671.497});
const NO_START = new Set(Array.from('、。，．・：；？！‼⁇⁈⁉）)]｝}〕〉》」』】〙〗〟’”｠»ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー〜～…‥'));
const NO_END = new Set(Array.from('（([｛{〔〈《「『【〘〖〝‘“｟«'));
const graphemeSplitter = typeof Intl.Segmenter==='function' ? new Intl.Segmenter('ja',{granularity:'grapheme'}) : null;
export function graphemes(text){return graphemeSplitter?Array.from(graphemeSplitter.segment(text),x=>x.segment):Array.from(text);}
export function normalizeBody(text){return text.replace(/\r\n?|[\u2028\u2029\u0085]/g,'\n').replace(/\u00a0/g,' ').replace(/\t/g,'　').normalize('NFC');}
const narrow=s=>s.replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
export function rubyMatches(text){return Array.from(text.matchAll(/｜([^｜《》\n]+)《([^《》\n]*)》|《([^｜《》\n]+)《([^《》\n]*)》》/g),m=>Object.assign([m[0],m[1]??m[3],m[2]??m[4]],{index:m.index}));}
export function textUnits(text,{combineDigits=true,markup=true}={}){
  const chars=graphemes(text),units=[];
  for(let i=0;i<chars.length;){
    if(chars[i]==='｛'||chars[i]==='{'){
      const end=chars.indexOf(chars[i]==='{'?'}':'｝',i+1);
      if(end<0)throw new Error('斜体の指定が閉じていません。{文字} の形で、同じ幅の括弧を使い、改行せずに囲んでください。');
      const body=chars.slice(i+1,end).join('');
      if(!body||/[｛｝{}\n]/u.test(body))throw new Error('斜体には、空でない文字を入れてください。括弧の入れ子や改行は使えません。');
      units.push(...textUnits(body,{combineDigits,markup}).map(u=>({...u,italic:true})));
      i=end+1;continue;
    }
    if(markup&&(chars[i]==='｜'||chars[i]==='《')){
      const wrapped=chars[i]==='《';
      const open=chars.indexOf('《',i+1),close=chars.indexOf('》',i+1);
      if(open>i&&close>open&&!chars.slice(i+1,open).some(c=>/[\n｜《》]/u.test(c))){
        if(wrapped&&chars[close+1]!=='》')throw new Error('ルビの指定が閉じていません。《きみ《あなた》》の形にしてください。');
        const base=chars.slice(i+1,open).join(''),reading=chars.slice(open+1,close).join('');
        if(!base||graphemes(base).length>20||/[\s\[\]《》｜]/u.test(base))throw new Error('ルビの親文字は、空白・記号を含まない1〜20文字にしてください。');
        const parent=textUnits(base,{combineDigits,markup:false}),rubyChars=graphemes(reading);
        if(!reading||rubyChars.length>60||rubyChars.length>parent.length*4||/[\s\[\]《》｜]/u.test(reading))throw new Error('読み仮名は親文字1枠につき4文字以内、全体で60文字以内にしてください。空白やルビの記号は使えません。');
        const ruby={reading,total:parent.length};parent.forEach((u,n)=>units.push({...u,ruby,rubyIndex:n}));i=close+(wrapped?2:1);continue;
      }
      if(open>i&&!chars.slice(i+1,open).some(c=>/[\n｜《》]/u.test(c)))throw new Error('ルビの指定が閉じていません。《きみ《あなた》》または｜きみ《あなた》の形にしてください。');
    }
    if(markup&&chars[i]==='['&&chars[i+1]==='['){
      let end=i+2;while(end<chars.length&&!(chars[end]===']'&&chars[end+1]===']'))end++;
      if(end===chars.length)throw new Error('組文字の指定が閉じていません。[[12]]のように囲んでください。');
      const selected=chars.slice(i+2,end);
      if(!selected.length||selected.length>4||selected.some(c=>/\s|\[|\]/u.test(c)))throw new Error('組文字には、空白や改行を含まない1〜4文字を指定してください。');
      const original=selected.join('');units.push({text:original,display:narrow(original),kind:'tcy'});i=end+2;continue;
    }
    if(/^[0-9０-９]$/u.test(chars[i])){
      const half=/^[0-9]$/u.test(chars[i]),pattern=half?/^[0-9]$/u:/^[０-９]$/u;
      let end=i+1;while(end<chars.length&&pattern.test(chars[end]))end++;
      const digits=chars.slice(i,end).join('');
      if(combineDigits&&end-i===2)units.push({text:digits,display:narrow(digits),kind:'tcy'});
      else for(const digit of chars.slice(i,end))units.push({text:digit,display:digit,kind:half&&end-i>=3?'sideways-digit':'upright'});
      i=end;continue;
    }
    if(/^[!?！？]$/u.test(chars[i])){
      let end=i+1;while(end<chars.length&&/^[!?！？]$/u.test(chars[end]))end++;
      if(end-i===2){const pair=chars.slice(i,end).join('');units.push({text:pair,display:narrow(pair),kind:'tcy'});}
      else for(const c of chars.slice(i,end))units.push({text:c,display:c,kind:'upright'});
      i=end;continue;
    }
    units.push({text:chars[i],display:chars[i],kind:'normal'});i++;
  }
  return units;
}
export function breakLines(text,indent=true,combineDigits=true,rows=SPEC.rows){
  const lines=[];
  const paragraphs=normalizeBody(text).split('\n');
  while(paragraphs.length>1&&paragraphs.at(-1)==='')paragraphs.pop();
  for(const paragraph of paragraphs){
    if(!paragraph.trim()){lines.push([]);continue;}
    let chars=textUnits(paragraph,{combineDigits});
    if(indent&&!/^[ 　]/u.test(paragraph))chars.unshift({text:'　',display:'　',kind:'normal'});
    while(chars.length){
      // Half-width spaces consume half a row; keep source characters intact.
      let end=0,used=0;
      while(end<chars.length){
        const advance=chars[end].text===' '?0.5:1;
        if(used+advance>rows)break;
        used+=advance;end++;
      }
      end=Math.max(1,end);
      if(end<chars.length){
        while(end>1&&(NO_END.has(chars[end-1].text.at(-1))||NO_START.has(chars[end].text[0])))end--;
        if(chars[end]?.ruby&&chars[end-1]?.ruby===chars[end].ruby){
          const group=chars[end].ruby;let first=end;while(first>0&&chars[first-1].ruby===group)first--;
          if(first>0)end=first;
        }
      }
      let rowOffset=0;
      lines.push(chars.slice(0,end).map(unit=>{
        const positioned={...unit,rowOffset};
        rowOffset+=unit.text===' '?0.5:1;
        return positioned;
      }));chars=chars.slice(end);
    }
  }
  return lines;
}
export function paginate({title='',author='',body='',indent=true,startSide='odd',combineDigits=true,pageSettings,font}){
  title=title.trim().normalize('NFC');author=author.trim().normalize('NFC');
  if(!body.trim())throw new Error('本文を入力してください。');
  if(graphemes(body).length>50000)throw new Error('本文は50,000字までにしてください。');
  if(prefaceLength(title)>54)throw new Error('作品タイトルは54字までにしてください。');
  if(prefaceLength(author)>18)throw new Error('作者名は18字までにしてください。');
  const SPEC=pageGeometry(pageSettings);
  if(SPEC.rows<4||SPEC.columns<4)throw new Error('本文を配置する範囲が狭すぎます。余白を減らしてください。');
  const titleRows=Math.min(27,Math.max(1,Math.floor((SPEC.bottom-SPEC.top-56.693)/26)));
  const titleChars=textUnits(title,{combineDigits}),authorChars=textUnits(author,{combineDigits});
  const titleColumns=titleChars.length?Math.ceil(titleChars.length/titleRows):0;
  const firstReserve=title||author?Math.max(titleColumns,1)+2:0;
  if(firstReserve>=SPEC.columns)throw new Error('タイトルと本文が収まりません。余白を減らすか、タイトルを短くしてください。');
  if(authorChars.length*22>SPEC.bottom-SPEC.top-61.321)throw new Error('作者名が収まりません。上下の余白を減らしてください。');
  const lines=breakLines(body,indent,combineDigits,SPEC.rows);
  const pages=[];let cursor=0;
  while(cursor<lines.length){
    const index=pages.length,offset=index===0?firstReserve:0;
    const count=SPEC.columns-offset;
    const pageLines=lines.slice(cursor,cursor+count);cursor+=pageLines.length;
    const odd=(index+(startSide==='even'?1:0))%2===0;
    const right=odd?SPEC.oddRight:SPEC.evenRight;
    const cells=[];
    pageLines.forEach((line,col)=>line.forEach((unit,row)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:right-(col+offset)*SPEC.linePitch-SPEC.bodySize/2,y:SPEC.top+unit.rowOffset*SPEC.pitch,size:SPEC.bodySize,role:'body'})));
    if(index===0){
      titleChars.forEach((unit,n)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:right-Math.floor(n/titleRows)*SPEC.linePitch-13,y:SPEC.top+56.693+(n%titleRows)*26,size:26,role:'title'}));
      const authorX=right-25.8-(authorChars.some(u=>u.ruby)?12:0)-(titleColumns>1?SPEC.linePitch:0);
      authorChars.forEach((unit,n)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:authorX-11,y:SPEC.bottom-61.321-authorChars.length*22+n*22,size:22,role:'author'}));
    }
    pages.push({cells,lines:pageLines,offset,index,side:odd?'odd':'even',width:SPEC.width,height:SPEC.height});
  }
  return {title,author,body:normalizeBody(body),indent,startSide,combineDigits,pages:withRuby(pages,font),characterCount:lines.flat().reduce((n,u)=>n+graphemes(u.text.replace(/\s/g,'')).length,0)};
}
function paginateAfterwordLegacy({title='あとがき',author='',body='',indent=true,startSide='odd',combineDigits=true,font}){
  title=title.trim().normalize('NFC')||'あとがき';author=author.trim().normalize('NFC');
  if(!body.trim())throw new Error('あとがきの本文を入力してください。');
  if(graphemes(body).length>50000)throw new Error('本文は50,000字までにしてください。');
  if(prefaceLength(title)>18)throw new Error('あとがきの見出しは18字までにしてください。');
  if(prefaceLength(author)>18)throw new Error('作者名は18字までにしてください。');
  const rows=48,columns=9,bodySize=18,pitch=17,linePitch=34;
  const lines=breakLines(body,indent,combineDigits,rows),pages=[];
  const heading=textUnits(title,{combineDigits}),name=textUnits(author,{combineDigits});
  for(let cursor=0;cursor<lines.length;cursor+=columns){
    const index=pages.length,cells=[],pageLines=lines.slice(cursor,cursor+columns);
    pageLines.forEach((line,col)=>line.forEach((unit,row)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:500-col*linePitch,y:130+unit.rowOffset*pitch,size:bodySize,role:'body'})));
    heading.forEach((unit,n)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:586,y:186+n*24,size:24,role:'title'}));
    if(cursor+columns>=lines.length)name.forEach((unit,n)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:500-(pageLines.length+1)*linePitch,y:876-name.length*22+n*22,size:22,role:'author'}));
    pages.push({cells,lines:pageLines,index,side:(index+(startSide==='even'?1:0))%2?'even':'odd',layout:'afterword'});
  }
  return {title,author,body:normalizeBody(body),indent,startSide,combineDigits,pages:withRuby(pages,font)};
}
export function plainText(text){let result=normalizeBody(text);for(const m of rubyMatches(result).reverse())result=result.slice(0,m.index)+m[1]+result.slice(m.index+m[0].length);return result.replace(/\[\[([^\n]*?)\]\]/g,'$1').replace(/｛([^｛｝{}\n]+)｝|\{([^｛｝{}\n]+)\}/g,(_,wide,half)=>wide??half);}
export function prefaceLength(text){return graphemes(plainText(text).replace(/\n/g,'')).length;}
// Ruby uses ordinary positioned cells, so preview, PDF and WebP share one layout.
function withRuby(pages,font){
  // Use the selected font's horizontal advance for sideways Latin letters.
  // Keep explicit spaces, column breaks and bottom-aligned author names intact.
  if(font)for(const page of pages){
    const columns=new Map();
    for(const cell of page.cells){
      if(cell.role==='preface-heading')continue;
      const key=`${cell.role}:${cell.x}:${cell.size}`;
      if(!columns.has(key))columns.set(key,[]);
      columns.get(key).push(cell);
    }
    for(const cells of columns.values()){
      cells.sort((a,b)=>a.y-b.y);let saved=0;
      for(const cell of cells){
        cell.y-=saved;
        if(cell.kind==='sideways-digit'||(cell.kind==='normal'&&isSideways(cell.char))){
          const active=cell.italic&&font.italicFont?font.italicFont:font;const run=glyphRun(active,cell.char,true);
          cell.advance=run.positions.reduce((n,p)=>n+p.xAdvance,0)*cell.size/active.unitsPerEm;
          cell.kind='sideways-tight';saved+=cell.size-cell.advance;
        }
      }
      if(cells[0]?.role==='author'||cells[0]?.role==='toc-author')for(const cell of cells)cell.y+=saved;
    }
  }
  // Reduce Gothic body glyphs around their centres; retain line/page geometry.
  if(font?.bodyScale&&font.bodyScale!==1)for(const page of pages)for(const cell of page.cells){
    if(cell.role!=='body'&&cell.role!=='preface')continue;
    const oldSize=cell.size;cell.size*=font.bodyScale;
    cell.x+=(oldSize-cell.size)/2;cell.y+=(oldSize-cell.size)/2;
    if(cell.advance!==undefined)cell.advance*=font.bodyScale;
  }
  for(const page of pages){
    const groups=new Map();
    for(const cell of page.cells){if(!cell.ruby)continue;let columns=groups.get(cell.ruby);if(!columns)groups.set(cell.ruby,columns=new Map());const key=cell.x+':'+cell.role;if(!columns.has(key))columns.set(key,[]);columns.get(key).push(cell);}
    for(const [ruby,columns] of groups)for(const cells of columns.values()){
      const first=cells[0],last=cells.at(-1),reading=graphemes(ruby.reading);
      const start=Math.floor(first.rubyIndex*reading.length/ruby.total),end=Math.floor((last.rubyIndex+1)*reading.length/ruby.total),part=reading.slice(start,end);
      if(!part.length)continue;
      const span=last.y-first.y+(last.advance??first.size),size=Math.min(first.size*.42,span/part.length),top=first.y+(span-part.length*size)/2;
      part.forEach((char,n)=>page.cells.push({char,source:char,kind:'normal',x:first.x+first.size+1,y:top+n*size,size,role:'ruby'}));
    }
  }
  return pages;
}
function paginateReaderLegacy({title='',author='',body='',preface='',indent=true,startSide='odd',combineDigits=true,font}){
  title=title.trim().normalize('NFC');author=author.trim().normalize('NFC');
  if(!title)throw new Error('読者寄稿のタイトルを入力してください。');
  if(!author)throw new Error('読者寄稿の作者名を入力してください。');
  if(!body.trim())throw new Error('読者寄稿の本文を入力してください。');
  if(prefaceLength(title)>27)throw new Error('読者寄稿のタイトルは27字までにしてください。');
  if(prefaceLength(author)>18)throw new Error('作者名は18字までにしてください。');
  if(graphemes(body).length>50000)throw new Error('本文は50,000字までにしてください。');
  if(prefaceLength(preface)>150)throw new Error('前書きは150文字までにしてください。');
  const intro=breakLines(preface,false,combineDigits,32);
  if(intro.length>5)throw new Error('前書きの改行・空行を減らして、5行以内に収めてください。');
  const lines=breakLines(body,indent,combineDigits),pages=[];
  const add=(cells,unit,x,y,size,role)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x,y,size,role});
  for(let cursor=0;cursor<lines.length;){
    const index=pages.length,first=index===0,odd=(index+(startSide==='even'?1:0))%2===0;
    const pageLines=lines.slice(cursor,cursor+(first?7:SPEC.columns));cursor+=pageLines.length;
    const cells=[],right=first?330:(odd?SPEC.oddRight:SPEC.evenRight);
    pageLines.forEach((line,col)=>line.forEach((u,row)=>add(cells,u,right-col*SPEC.linePitch-SPEC.bodySize/2,SPEC.top+u.rowOffset*SPEC.pitch,SPEC.bodySize,'body')));
    const page={cells,lines:pageLines,index,side:odd?'odd':'even',layout:'reader'};
    if(first){
      textUnits(title,{combineDigits}).forEach((u,n)=>add(cells,u,422,184+n*26,26,'title'));
      const name=textUnits(author,{combineDigits});name.forEach((u,n)=>add(cells,u,name.some(c=>c.ruby)?388:400,873.635-name.length*22+n*22,22,'author'));
      const ruleX=510+176*134/1254,ruleWidth=176*(1121-134)/1254;
      const heading=textUnits('まえがき',{markup:false}),headingSize=16,headingPitch=30;
      const headingX=ruleX+(ruleWidth-((heading.length-1)*headingPitch+headingSize))/2;
      heading.forEach((u,n)=>add(cells,u,headingX+n*headingPitch,343,headingSize,'preface-heading'));
      intro.forEach((line,col)=>line.forEach((u,row)=>add(cells,u,636-col*25,382+u.rowOffset*17,16,'preface')));
      page.images=[{data:readerLogo,x:510,y:128,width:176,height:176}];
      // Match the visible logo edges (excluding transparent PNG padding).
      page.rules=[{x:ruleX,y:368,width:ruleWidth,height:1.5,color:'#253c59'}];
    }
    pages.push(page);
  }
  return {title,author,body:normalizeBody(body),preface,indent,startSide,combineDigits,pages:withRuby(pages,font)};
}
function paginateTocLegacy({entries=[],font}){
  const rows=entries.filter(e=>e.title?.trim()||e.author?.trim());
  if(!rows.length)throw new Error('目次に作品タイトルを入力してください。');
  if(rows.length>10)throw new Error('目次は、あとがきを含めて10項目までです。');
  const cells=[],top=235,bottom=824,pitch=Math.min(48,480/Math.max(1,rows.length-1));
  const add=(u,x,y,size,role)=>cells.push({char:u.display,source:u.text,kind:u.kind,italic:u.italic,ruby:u.ruby,rubyIndex:u.rubyIndex,x,y,size,role});
  textUnits('目次').forEach((u,n)=>add(u,654,264+n*26,26,'toc-heading'));
  rows.forEach((entry,index)=>{
    if(!entry.title?.trim())throw new Error(`目次の${index+1}番目にタイトルを入力してください。`);
    const title=textUnits(entry.title.trim().normalize('NFC')),author=textUnits((entry.author||'').trim().normalize('NFC'));
    if(title.length>54||author.length>18)throw new Error('目次のタイトルは54字、作者名は18字までにしてください。');
    const x=596-index*pitch,authorTop=bottom-author.length*22;
    const label=entry.reader&&author.length?textUnits('読者寄稿'):[];
    const labelTop=authorTop-18-label.length*14;
    const available=(label.length?labelTop:author.length?authorTop:bottom)-top-24;
    const titleSize=Math.min(22,available/Math.max(1,title.length));
    if(titleSize<14)throw new Error(`「${entry.title}」は目次の縦1列に収まりません。目次用のタイトルを短くしてください。`);
    title.forEach((u,n)=>add(u,x+(22-titleSize)/2,top+n*titleSize,titleSize,'toc-title'));
    author.forEach((u,n)=>add(u,x,authorTop+n*22,22,'toc-author'));
    label.forEach((u,n)=>add(u,x+4,labelTop+n*14,14,'toc-reader'));
  });
  return {title:'目次',author:'',pages:withRuby([{cells,index:0,layout:'toc'}],font)};
}
export function isSideways(char){return !/^[0-9０-９!?！？]+$/u.test(char)&&/^[\u0021-\u007e\u00a1-\u024f]/u.test(char);}
const HORIZONTAL_FEATURES={kern:false,liga:false,clig:false};
export function fontText(font,text){
  // Preserve source text. Substitute only missing glyphs at render/export time.
  if(text.includes('－')&&!font.hasGlyphForCodePoint(0xff0d)&&font.hasGlyphForCodePoint(0x2010))text=text.replaceAll('－','‐');
  return text.includes('―')&&!font.hasGlyphForCodePoint(0x2015)&&font.hasGlyphForCodePoint(0x2014)?text.replaceAll('―','—'):text;
}
export function glyphRun(font,char,horizontal=false){return font.layout(fontText(font,char),horizontal?HORIZONTAL_FEATURES:['vert','vrt2']);}
export function glyphPosition(font,cell){
  font=cell.italic&&font.italicFont?font.italicFont:font;
  const combined=cell.kind==='tcy';
  const sideways=cell.kind==='sideways-digit'||cell.kind==='sideways-tight'||(!combined&&cell.kind!=='upright'&&isSideways(cell.char)),run=glyphRun(font,cell.char,combined||sideways);
  let fontSize=cell.size;
  const advance=run.positions.reduce((n,p)=>n+p.xAdvance,0);
  if(combined)fontSize*=Math.min(1, font.unitsPerEm/Math.max(advance,1));
  const scale=fontSize/font.unitsPerEm;
  const width=run.positions.reduce((n,p)=>n+p.xAdvance,0)*scale;
  const pad=cell.kind==='sideways-tight'?0:(cell.size-width)/2;
  let baseline=cell.y+cell.size*.88;
  if(combined){
    const minY=Math.min(...run.glyphs.map((g,i)=>g.bbox.minY+run.positions[i].yOffset));
    const maxY=Math.max(...run.glyphs.map((g,i)=>g.bbox.maxY+run.positions[i].yOffset));
    if(Number.isFinite(minY)&&Number.isFinite(maxY))baseline=cell.y+cell.size/2+(minY+maxY)*scale/2;
  }
  return {sideways,combined,run,scale,pad,baseline,fontSize};
}
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Vertical Japanese oblique: the right side rises (screen y decreases).
// Anchor at the cell centre so the baseline/column position does not drift.
// Share the same page-coordinate transform across SVG, WebP and PDF.
export function italicMatrix(cell,font){
  const k=Math.tan(Math.PI/15),cx=cell.x+cell.size/2;
  return [1,-k,0,1,0,k*cx];
}
let pageSvgSerial=0;
export function pageSvg(page,font,{grid=false,label='誌面プレビュー'}={}){
  const SPEC={width:page.width||768.24,height:page.height||768.24*Math.SQRT2};
  font=page.font||font;
  // Inline SVG IDs are document-wide. Each rendered page needs its own namespace.
  const glyphPrefix=`mijitaku-text-${++pageSvgSerial}-g`;
  const definitions=new Map();const uses=[];
  for(const cell of page.cells){
    const {sideways,run,scale,pad,baseline}=glyphPosition(font,cell);
    let pen=0;const parts=[];
    run.glyphs.forEach((g,i)=>{
      if(!definitions.has(g))definitions.set(g,{id:glyphPrefix+definitions.size,path:g.path.toSVG()});
      const p=run.positions[i];
      parts.push(`<use href="#${definitions.get(g).id}" transform="translate(${cell.x+pad+(pen+p.xOffset)*scale} ${baseline-p.yOffset*scale}) scale(${scale} ${-scale})"/>`);
      pen+=p.xAdvance;
    });
    const shapes=sideways?`<g transform="rotate(90 ${cell.x+cell.size/2} ${cell.y+cell.size/2})">${parts.join('')}</g>`:parts.join('');
    uses.push(cell.italic?`<g transform="matrix(${italicMatrix(cell,font).join(' ')})">${shapes}</g>`:shapes);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPEC.width} ${SPEC.height}" role="img" aria-label="${xml(label)}"><title>${xml(label)}</title><rect width="100%" height="100%" fill="white"/><defs>${Array.from(definitions.values(),({id,path:d})=>`<path id="${id}" d="${xml(d)}"/>`).join('')}</defs><g fill="#111111">${uses.join('')}</g>${(page.images||[]).map(r=>`<image href="${r.data}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/>`).join('')}${(page.rules||[]).map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.color}"/>`).join('')}</svg>`;
}
export function missingCharacters(doc,font){
  return Array.from(new Set(doc.pages.flatMap(p=>p.cells).filter(c=>glyphPosition(font,c).run.glyphs.some(g=>g.id===0)).map(c=>c.source||c.char)));
}
export async function createPdf(doc,fontBytes,font,fontkit,PDFLib,onProgress=()=>{}){
  const {PDFDocument,rgb,degrees}=PDFLib;
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  pdf.setTitle(doc.title||'身仕度');pdf.setAuthor(doc.author||'');pdf.setCreator('身仕度 組版室 v0.3');pdf.setSubject('月刊身仕度');
  const embeddedFonts=new Map();
  async function embedded(active,horizontal){
    const bytes=active?.sourceBytes||fontBytes;
    if(!embeddedFonts.has(bytes))embeddedFonts.set(bytes,{});
    const fonts=embeddedFonts.get(bytes),key=horizontal?'horizontal':'vertical';
    if(!fonts[key])fonts[key]=await pdf.embedFont(bytes,{subset:false,features:horizontal?HORIZONTAL_FEATURES:['vert','vrt2']});
    return fonts[key];
  }
  const sources=new Map();
  for(const page of doc.pages){
    const SPEC={width:page.width||768.24,height:page.height||768.24*Math.SQRT2};
    const out=pdf.addPage([SPEC.width,SPEC.height]);
    if(page.pdfSource&&!page.image.raster){
      if(!sources.has(page.pdfSource))sources.set(page.pdfSource,await PDFDocument.load(page.pdfSource.data));
      const original=sources.get(page.pdfSource).getPage(page.pdfIndex),box=original.getCropBox();
      const embedded=await pdf.embedPage(original,{left:box.x,bottom:box.y,right:box.x+box.width,top:box.y+box.height});
      const rotation=((original.getRotation().angle%360)+360)%360,turned=rotation===90||rotation===270;
      const w=turned?box.height:box.width,h=turned?box.width:box.height,s=Math.min(SPEC.width/w,SPEC.height/h);
      const x=(SPEC.width-w*s)/2,y=(SPEC.height-h*s)/2;
      out.drawPage(embedded,{x:x+(rotation===180||rotation===270?w*s:0),y:y+(rotation===90||rotation===180?h*s:0),width:box.width*s,height:box.height*s,rotate:degrees(-rotation)});
    }else if(page.kind==='image'){
      const img=await pdf.embedJpg(page.image.data),r=page.placement;
      if(page.clip){const c=page.clip;out.pushOperators(PDFLib.pushGraphicsState(),PDFLib.rectangle(c.x,SPEC.height-c.y-c.height,c.width,c.height),PDFLib.clip(),PDFLib.endPath());}
      out.drawImage(img,{x:r.x,y:SPEC.height-r.y-r.height,width:r.width,height:r.height});
      if(page.clip)out.pushOperators(PDFLib.popGraphicsState());
    }
    for(const r of page.images||[]){const img=await (/^data:image\/png[;,]/i.test(r.data)?pdf.embedPng(r.data):pdf.embedJpg(r.data));out.drawImage(img,{x:r.x,y:SPEC.height-r.y-r.height,width:r.width,height:r.height});}
    for(const r of page.rules||[])out.drawRectangle({x:r.x,y:SPEC.height-r.y-r.height,width:r.width,height:r.height,color:rgb(...[1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16)/255))});
    for(const cell of page.cells||[]){
      const selected=page.font||font,active=cell.italic&&selected.italicFont?selected.italicFont:selected;
      const pos=glyphPosition(selected,cell),drawFont=await embedded(active,pos.sideways||pos.combined);
      if(cell.italic){const [a,b,c,d,e,f]=italicMatrix(cell,selected);out.pushOperators(PDFLib.pushGraphicsState(),PDFLib.concatTransformationMatrix(a,-b,-c,d,c*SPEC.height+e,SPEC.height*(1-d)-f));}
      out.drawText(fontText(active,cell.char),{font:drawFont,size:pos.fontSize,color:rgb(.067,.067,.067),x:pos.sideways?cell.x+cell.size*.12:cell.x+pos.pad,y:pos.sideways?SPEC.height-cell.y-pos.pad:SPEC.height-pos.baseline,rotate:degrees(pos.sideways?-90:0)});
      if(cell.italic)out.pushOperators(PDFLib.popGraphicsState());
    }
    onProgress(page.index+1,doc.pages.length);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  await pdf.flush();
  // Keep separate shaping/Unicode maps. Only share byte-identical font programs.
  // Limit this to fonts created above; imported PDFs are left intact.
  const fontPrograms=new Map(),name=PDFLib.PDFName.of('FontFile2');
  for(const fonts of embeddedFonts.values())for(const embeddedFont of Object.values(fonts)){
    const type0=pdf.context.lookup(embeddedFont.ref);
    const descendants=type0.lookup(PDFLib.PDFName.of('DescendantFonts'),PDFLib.PDFArray);
    const descendant=descendants.lookup(0,PDFLib.PDFDict);
    const object=descendant.lookup(PDFLib.PDFName.of('FontDescriptor'),PDFLib.PDFDict);
    if(!object.has(name))continue;
    const ref=object.get(name),stream=pdf.context.lookup(ref);
    if(!(ref instanceof PDFLib.PDFRef)||!(stream instanceof PDFLib.PDFRawStream))continue;
    const bytes=stream.getContents(),key=stream.dict.toString(),candidates=fontPrograms.get(key)||[];
    const same=candidates.find(candidate=>candidate.bytes.length===bytes.length&&candidate.bytes.every((byte,index)=>byte===bytes[index]));
    if(same){object.set(name,same.ref);pdf.context.delete(ref);}
    else{candidates.push({ref,bytes});fontPrograms.set(key,candidates);}
  }
  return pdf.save();
}

export function paginateAfterword(options){return fitTemplate(paginateAfterwordLegacy(options),options.pageSettings,options.startSide);}
export function paginateReader(options){return fitTemplate(paginateReaderLegacy(options),options.pageSettings,options.startSide);}
export function paginateToc(options){return fitTemplate(paginateTocLegacy(options),options.pageSettings,options.startSide);}
