import {pageGeometry,fitTemplate} from './page-settings.js?v=57';
import {readerLogo} from './reader-logo.js?v=23';
export const SPEC = Object.freeze({width:768.24,height:768.24*Math.SQRT2,rows:36,columns:15,bodySize:22,titleSize:26,pitch:22.44,linePitch:38,top:127.556,oddRight:643.151,evenRight:671.497});
const NO_START = new Set(Array.from('、。，．・：；？！‼⁇⁈⁉）)]｝}〕〉》」』】〙〗〟’”｠»ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー〜～…‥'));
const NO_END = new Set(Array.from('（([｛{〔〈《「『【〘〖〝‘“｟«'));
const graphemeSplitter = typeof Intl.Segmenter==='function' ? new Intl.Segmenter('ja',{granularity:'grapheme'}) : null;
export function graphemes(text){return graphemeSplitter?Array.from(graphemeSplitter.segment(text),x=>x.segment):Array.from(text);}
export function normalizeBody(text){
  // Normalize tabs only for layout; the editor keeps the original manuscript.
  return text.replace(/\r\n?|[\u2028\u2029\u0085]/g,'\n').replace(/\u00a0/g,' ')
    .replace(/^[ 　\t]*\t[ 　\t]*/gm,'　').replace(/\t/g,' ').normalize('NFC');
}
const narrow=s=>s.replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
export function rubyMatches(text){return Array.from(text.matchAll(/｜([^｜《》\n]+)《([^《》\n]*)》|《([^｜《》\n]+)《([^《》\n]*)》》/g),m=>Object.assign([m[0],m[1]??m[3],m[2]??m[4]],{index:m.index}));}
export function textUnits(text,{combineDigits=true,markup=true}={}){
  // Size tags are stored in the manuscript, like ruby and combined-character tags.
  if(/\[Q=|\[\/Q\]/u.test(text)){
    const result=[];let cursor=0;
    for(const m of text.matchAll(/\[Q=([0-9]+(?:\.[0-9]+)?)\]([^\n]*?)\[\/Q\]/gu)){
      const q=Number(m[1]);
      if(q<8||q>64||/\[Q=|\[\/Q\]/u.test(m[2]))throw new Error('級数は8〜64Qで指定してください。級数の入れ子は使えません。');
      const before=text.slice(cursor,m.index);
      if(/\[Q=|\[\/Q\]/u.test(before))throw new Error('級数の指定が閉じていません。[Q=40]文字[/Q] の形にしてください。');
      result.push(...textUnits(before,{combineDigits,markup}),...textUnits(m[2],{combineDigits,markup}).map(u=>({...u,q,size:q*72/101.6})));
      cursor=m.index+m[0].length;
    }
    const rest=text.slice(cursor);
    if(/\[Q=|\[\/Q\]/u.test(rest))throw new Error('級数の指定が閉じていません。段落ごとに [Q=40]文字[/Q] の形で囲んでください。');
    result.push(...textUnits(rest,{combineDigits,markup}));return result;
  }
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
// Full-width Japanese punctuation carries half-em side bearings.
// Trim the shared bearings, never manuscript characters or combined/ruby units.
function punctuationReduction(left,right){
  if(!left||!right||left.ruby||right.ruby||left.kind==='tcy'||right.kind==='tcy')return 0;
  const a=left.text??left.source??left.char,b=right.text??right.source??right.char;
  const open=c=>'（［｛〔〈《「『【〘〖〝｟'.includes(c)&&c.length===1;
  const close=c=>'）］｝〕〉》」』】〙〗〟｠'.includes(c)&&c.length===1;
  const end=c=>close(c)||/^[、。，．]$/u.test(c);
  if((open(a)&&open(b))||(end(a)&&(end(b)||open(b))))return 0.5;
  if((close(a)&&/^[・：；]$/u.test(b))||(/^[・：；]$/u.test(a)&&open(b)))return 0.5;
  if((a==='　'&&open(b))||(close(a)&&b==='　'))return 0.5;
  return 0;
}
export function breakLines(text,indent=true,combineDigits=true,rows=SPEC.rows,{font,size=SPEC.bodySize,pitch=SPEC.pitch,autoPunctuationSpace=false,lineRows,acceptLine}={}){
  const advances=new Map();
  const unitSize=u=>u?.size??size;
  const trim=(a,b)=>punctuationReduction(a,b)*Math.min(unitSize(a),unitSize(b))/pitch;
  const rowAdvance=unit=>{
    if(unit.size){
      let extent=unit.size;
      if(unit.text===' ')extent*=.5;
      else if(font&&(unit.kind==='sideways-digit'||(unit.kind==='normal'&&isSideways(unit.display)))){
        const active=unit.italic&&font.italicFont?font.italicFont:font;
        extent=glyphRun(active,unit.display,true).positions.reduce((n,p)=>n+p.xAdvance,0)*unit.size/active.unitsPerEm;
      }
      return (extent+Math.max(0,pitch-size))/pitch;
    }
    if(unit.text===' ')return 0.5;
    if(!font||!(unit.kind==='sideways-digit'||(unit.kind==='normal'&&isSideways(unit.display))))return 1;
    const active=unit.italic&&font.italicFont?font.italicFont:font;
    const key=(unit.italic?'italic:':'normal:')+unit.display;
    if(!advances.has(key)){
      const width=glyphRun(active,unit.display,true).positions.reduce((n,p)=>n+p.xAdvance,0)*size/active.unitsPerEm;
      // Match the exact compression applied by withRuby, including letter spacing.
      advances.set(key,Math.max(0.01,1-(size-width)/pitch));
    }
    return advances.get(key);
  };
  const lines=[];
  const paragraphs=normalizeBody(text).split('\n');
  while(paragraphs.length>1&&paragraphs.at(-1)==='')paragraphs.pop();
  for(const paragraph of paragraphs){
    if(!paragraph.trim()){if(lineRows)lineRows(lines.length);if(acceptLine)acceptLine([],lines.length);lines.push([]);continue;}
    let chars=textUnits(paragraph,{combineDigits});
    if(autoPunctuationSpace)chars=chars.flatMap((unit,index,all)=>{
      const next=all[index+1];
      const add=next&&/[!?！？‼⁇⁈⁉]$/u.test(unit.text)&&!(/^[\s!?！？‼⁇⁈⁉]/u.test(next.text)||NO_START.has(next.text[0]))&&!(unit.ruby&&unit.ruby===next.ruby);
      return add?[unit,{text:'　',display:'　',kind:'normal',automaticSpace:true}]:[unit];
    });
    if(indent&&!/^[ 　]/u.test(chars[0]?.text||''))chars.unshift({text:'　',display:'　',kind:'normal'});
    while(chars.length){
      while(chars[0]?.automaticSpace)chars.shift();
      if(!chars.length)break;
      if(lineRows)rows=lineRows(lines.length);
      // Half-width spaces consume half a row; keep source characters intact.
      let end=0,used=0;
      while(end<chars.length){
        const advance=rowAdvance(chars[end])-trim(chars[end-1],chars[end]);
        if(used+advance>rows)break;
        used+=advance;end++;
      }
      end=Math.max(1,end);
      // Pull prohibited line-start characters into this line using safe glyph gaps.
      // Font size and glyph proportions are never changed.
      let tightening=null;
      if(chars[end]&&NO_START.has(chars[end].text[0])&&!/^[、。]$/u.test(chars[end].text)){
        let target=end;
        while(target<chars.length&&NO_START.has(chars[target].text[0])&&!/^[、。]$/u.test(chars[target].text))target++;
        const candidate=chars.slice(0,target),capacities=[];
        let total=0;
        for(let i=0;i<candidate.length-1;i++){
          const a=candidate[i],b=candidate[i+1];let capacity=0;
          if(font&&!a.q&&!b.q&&!a.ruby&&!b.ruby&&!a.italic&&!b.italic&&a.kind==='normal'&&b.kind==='normal'&&!/\s/u.test(a.text+b.text)&&!isSideways(a.display)&&!isSideways(b.display)&&!punctuationReduction(a,b)){
            const bounds=u=>{
              const pos=glyphPosition(font,{char:u.display,kind:u.kind,size,x:0,y:0});
              return {top:pos.baseline-Math.max(...pos.run.glyphs.map((g,n)=>g.bbox.maxY+pos.run.positions[n].yOffset))*pos.scale,
                bottom:pos.baseline-Math.min(...pos.run.glyphs.map((g,n)=>g.bbox.minY+pos.run.positions[n].yOffset))*pos.scale};
            };
            const left=bounds(a),right=bounds(b);
            capacity=Math.max(0,Math.min(size*.04,pitch+right.top-left.bottom-size*.02))/pitch;
          }
          capacities.push(capacity);total+=capacity;
        }
        const occupied=candidate.reduce((sum,u,i)=>sum+rowAdvance(u)-trim(candidate[i-1],u),0);
        const excess=Math.max(0,occupied-rows);
        if(excess<=total&&(!chars[target]||!NO_START.has(chars[target].text[0]))&&!(chars[target]?.ruby&&chars[target-1]?.ruby===chars[target].ruby)){
          end=target;tightening=capacities.map(c=>total?c*excess/total:0);
        }
      }
      // Allow one Japanese comma/period to hang beyond the line's normal length.
      // Keep combined characters and ruby groups intact; other kinsoku rules still apply.
      if(chars[end]?.kind==='normal'&&!chars[end].ruby&&/^[、。]$/u.test(chars[end].text))end++;
      if(end<chars.length&&!tightening){
        while(end>1&&(NO_END.has(chars[end-1].text.at(-1))||NO_START.has(chars[end].text[0])))end--;
        if(chars[end]?.ruby&&chars[end-1]?.ruby===chars[end].ruby){
          const group=chars[end].ruby;let first=end;while(first>0&&chars[first-1].ruby===group)first--;
          if(first>0)end=first;
        }
      }
      const visible=chars.slice(0,end);
      while(visible.at(-1)?.automaticSpace)visible.pop();
      if(acceptLine&&!acceptLine(visible,lines.length))continue;
      chars=chars.slice(end);
      // Keep manuscript spaces, but suppress punctuation spacing at a soft wrap.
      // Explicit paragraph breaks and their indentation are handled separately.
      const horizontalSpace=unit=>unit&&/^[ 　]+$/u.test(unit.text);
      const lastContent=visible.findLast(unit=>!horizontalSpace(unit));
      if(lastContent&&/[!?！？‼⁇⁈⁉]$/u.test(lastContent.text)){
        while(horizontalSpace(chars[0]))chars.shift();
      }
      // Justify continuing lines only. Preserve spaces, bracket interiors, ruby
      // groups and Latin/number runs; never stretch a paragraph's final line.
      const gaps=[];
      const wordUnit=unit=>/^[A-Za-z0-9０-９]+$/u.test(unit.text);
      if(chars.length&&!tightening)for(let i=0;i<visible.length-1;i++){
        const left=visible[i],right=visible[i+1];
        if(horizontalSpace(left)||horizontalSpace(right)||punctuationReduction(left,right)||NO_END.has(left.text.at(-1))||NO_START.has(right.text[0]))continue;
        if(/[、。，．!?！？‼⁇⁈⁉]$/u.test(left.text)||(left.ruby&&left.ruby===right.ruby)||(wordUnit(left)&&wordUnit(right)))continue;
        gaps.push(i);
      }
      const occupied=visible.reduce((sum,unit,index)=>sum+rowAdvance(unit)-trim(visible[index-1],unit),0);
      const extra=gaps.length?Math.max(0,rows-occupied)/gaps.length:0;
      const expandable=new Set(gaps);
      const positionedSize=visible.some(u=>u.size);
      let rowOffset=0;
      lines.push(visible.map((unit,index)=>{
        if(positionedSize)rowOffset-=trim(visible[index-1],unit);
        const positioned={...unit,rowOffset,...(positionedSize?{positionedSize:true}:{})};
        rowOffset+=(positionedSize?rowAdvance(unit):(unit.text===' '?0.5:1))+(expandable.has(index)?extra:0)-(tightening?.[index]||0);
        return positioned;
      }));
    }
  }
  return lines;
}
export function bodyGeometry(pageSettings){return {...pageGeometry(pageSettings),columnSize:22};}
// Reserve extra width only beside the line that contains enlarged glyphs.
// Ordinary lines retain exactly their original centre-to-centre distance.
export function lineInsets(line,baseSize=22){
  let left=0,right=0;
  for(const u of line){const extra=Math.max(0,(u.size??baseSize)-baseSize);left=Math.max(left,extra/2);right=Math.max(right,extra/2+(u.ruby?extra*.42:0));}
  return {left,right};
}
export function packLines(lines,cursor,columns,baseSize=22,pitch=38){
  const packed=[];let previous=null;
  for(let i=cursor;i<lines.length;i++){
    const inset=lineInsets(lines[i],baseSize);
    const offset=previous?previous.offset+pitch+previous.inset.left+inset.right:inset.right;
    if(offset+inset.left>(columns-1)*pitch+1e-6){if(!packed.length)throw new Error('大きい文字が本文幅に収まりません。級数か余白を小さくしてください。');break;}
    previous={line:lines[i],offset,inset};packed.push(previous);
  }
  return packed;
}
export function sizedCell(unit,baseSize,x){
  const size=unit.size??baseSize;
  return {size,x:x+(baseSize-size)/2,...(unit.size?{explicitSize:true}:{}),...(unit.positionedSize?{positionedSize:true}:{})};
}
// Shared advances for titles and names: preserve full spaces, halve ASCII spaces.
const headingAdvance=unit=>unit.text===' '?0.5:1;
const headingLength=units=>units.reduce((sum,unit)=>sum+headingAdvance(unit),0);
function headingPositions(units,capacity=Infinity){
  let column=0,offset=0;
  return units.map(unit=>{
    const advance=headingAdvance(unit);
    if(offset+advance>capacity){column++;offset=0;}
    const position={unit,column,offset};offset+=advance;return position;
  });
}
export function paginate({title='',author='',body='',indent=true,startSide='odd',combineDigits=true,autoPunctuationSpace=false,pageSettings,font,geometryBody}){
  title=title.trim().normalize('NFC');author=author.trim().normalize('NFC');
  if(!body.trim())throw new Error('本文を入力してください。');
  if(graphemes(body).length>50000)throw new Error('本文は50,000字までにしてください。');
  if(prefaceLength(title)>54)throw new Error('作品タイトルは54字までにしてください。');
  if(prefaceLength(author)>18)throw new Error('作者名は18字までにしてください。');
  const SPEC=bodyGeometry(pageSettings,geometryBody??body);
  if(SPEC.rows<4||SPEC.columns<4)throw new Error('本文を配置する範囲が狭すぎます。余白を減らしてください。');
  const titleRows=Math.min(27,Math.max(1,Math.floor((SPEC.bottom-SPEC.top-56.693)/26)));
  const titleChars=textUnits(title,{combineDigits}),authorChars=textUnits(author,{combineDigits});
  const titlePositions=headingPositions(titleChars,titleRows);
  const titleColumns=titlePositions.length?titlePositions.at(-1).column+1:0;
  const firstReserve=title||author?Math.max(titleColumns,1)+2:0;
  if(firstReserve>=SPEC.columns)throw new Error('タイトルと本文が収まりません。余白を減らすか、タイトルを短くしてください。');
  if(headingLength(authorChars)*22>SPEC.bottom-SPEC.top-61.321)throw new Error('作者名が収まりません。上下の余白を減らしてください。');
  const lines=breakLines(body,indent,combineDigits,SPEC.rows,{font,size:SPEC.bodySize,pitch:SPEC.pitch,autoPunctuationSpace});
  const pages=[];let cursor=0;
  while(cursor<lines.length){
    const index=pages.length,offset=index===0?firstReserve:0;
    const count=SPEC.columns-offset;
    const packed=packLines(lines,cursor,count,SPEC.bodySize,SPEC.linePitch),pageLines=packed.map(p=>p.line);cursor+=pageLines.length;
    const odd=(index+(startSide==='even'?1:0))%2===0;
    const right=odd?SPEC.oddRight:SPEC.evenRight;
    const cells=[];
    pageLines.forEach((line,col)=>line.forEach((unit,row)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:right-offset*SPEC.linePitch-packed[col].offset-SPEC.bodySize/2,y:SPEC.top+unit.rowOffset*SPEC.pitch,...sizedCell(unit,SPEC.bodySize,right-offset*SPEC.linePitch-packed[col].offset-SPEC.bodySize/2),role:'body'})));
    if(index===0){
      titlePositions.forEach(({unit,column,offset})=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:right-column*SPEC.linePitch-13,y:SPEC.top+56.693+offset*26,size:26,role:'title'}));
      const authorX=right-25.8-(authorChars.some(u=>u.ruby)?12:0)-(titleColumns>1?SPEC.linePitch:0);
      headingPositions(authorChars).forEach(({unit,offset:n})=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:authorX-11,y:SPEC.bottom-61.321-headingLength(authorChars)*22+n*22,size:22,role:'author'}));
    }
    pages.push({cells,lines:pageLines,offset,index,side:odd?'odd':'even',width:SPEC.width,height:SPEC.height});
  }
  return {title,author,body:normalizeBody(body),indent,startSide,combineDigits,pages:withRuby(pages,font),characterCount:lines.flat().reduce((n,u)=>n+graphemes(u.text.replace(/\s/g,'')).length,0)};
}
function paginateAfterwordLegacy({title='あとがき',author='',body='',indent=true,startSide='odd',combineDigits=true,autoPunctuationSpace=false,font}){
  title=title.trim().normalize('NFC')||'あとがき';author=author.trim().normalize('NFC');
  if(!body.trim())throw new Error('あとがきの本文を入力してください。');
  if(graphemes(body).length>50000)throw new Error('本文は50,000字までにしてください。');
  if(prefaceLength(title)>18)throw new Error('あとがきの見出しは18字までにしてください。');
  if(prefaceLength(author)>18)throw new Error('作者名は18字までにしてください。');
  const rows=48,bodySize=18,pitch=17;
  const linePitch=34,columns=9;
  const lines=breakLines(body,indent,combineDigits,rows,{font,size:bodySize,pitch,autoPunctuationSpace}),pages=[];
  const heading=textUnits(title,{combineDigits}),name=textUnits(author,{combineDigits});
  for(let cursor=0;cursor<lines.length;){
    const packed=packLines(lines,cursor,columns,bodySize,linePitch);
    const index=pages.length,cells=[],pageLines=packed.map(p=>p.line);cursor+=pageLines.length;
    pageLines.forEach((line,col)=>line.forEach((unit,row)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:500-packed[col].offset,y:130+unit.rowOffset*pitch,...sizedCell(unit,bodySize,500-packed[col].offset),role:'body'})));
    headingPositions(heading).forEach(({unit,offset:n})=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:586,y:186+n*24,size:24,role:'title'}));
    if(cursor>=lines.length)headingPositions(name).forEach(({unit,offset:n})=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x:500-packed.at(-1).offset-packed.at(-1).inset.left-2*linePitch,y:876-headingLength(name)*22+n*22,size:22,role:'author'}));
    pages.push({cells,lines:pageLines,index,side:(index+(startSide==='even'?1:0))%2?'even':'odd',layout:'afterword'});
  }
  return {title,author,body:normalizeBody(body),indent,startSide,combineDigits,pages:withRuby(pages,font)};
}
export function plainText(text){let result=normalizeBody(text).replace(/\[Q=[0-9]+(?:\.[0-9]+)?\]|\[\/Q\]/g,'');for(const m of rubyMatches(result).reverse())result=result.slice(0,m.index)+m[1]+result.slice(m.index+m[0].length);return result.replace(/\[\[([^\n]*?)\]\]/g,'$1').replace(/｛([^｛｝{}\n]+)｝|\{([^｛｝{}\n]+)\}/g,(_,wide,half)=>wide??half);}
export function prefaceLength(text){return graphemes(plainText(text).replace(/\n/g,'')).length;}
// Ruby uses ordinary positioned cells, so preview, PDF and WebP share one layout.
export function withRuby(pages,font){
  // Use the selected font's horizontal advance for sideways Latin letters.
  // Keep explicit spaces, column breaks and bottom-aligned author names intact.
  for(const page of pages){
    const columns=new Map();
    for(const cell of page.cells){
      if(cell.role==='preface-heading')continue;
      const key=`${cell.role}:${cell.x}:${cell.size}`;
      if(!columns.has(key))columns.set(key,[]);
      columns.get(key).push(cell);
    }
    for(const cells of columns.values()){
      cells.sort((a,b)=>a.y-b.y);let saved=0,previous=null;
      for(const cell of cells){
        if(cell.positionedSize){if(font&&(cell.kind==='sideways-digit'||(cell.kind==='normal'&&isSideways(cell.char))))cell.kind='sideways-tight';continue;}
        saved+=punctuationReduction(previous,cell)*cell.size;
        cell.y-=saved;previous=cell;
        if(font&&(cell.kind==='sideways-digit'||(cell.kind==='normal'&&isSideways(cell.char)))){
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
    if(cell.explicitSize||(cell.role!=='body'&&cell.role!=='preface'))continue;
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
export function paginateReaderTemplate({title='',author='',body='',preface='',indent=true,startSide='odd',combineDigits=true,autoPunctuationSpace=false,font}){
  title=title.trim().normalize('NFC');author=author.trim().normalize('NFC');
  if(!title)throw new Error('読者寄稿のタイトルを入力してください。');
  if(!author)throw new Error('読者寄稿の作者名を入力してください。');
  if(!body.trim())throw new Error('読者寄稿の本文を入力してください。');
  if(prefaceLength(title)>27)throw new Error('読者寄稿のタイトルは27字までにしてください。');
  if(prefaceLength(author)>18)throw new Error('作者名は18字までにしてください。');
  if(graphemes(body).length>50000)throw new Error('本文は50,000字までにしてください。');
  if(prefaceLength(preface)>150)throw new Error('前書きは150文字までにしてください。');
  const intro=breakLines(preface,false,combineDigits,32,{font,size:16,pitch:17,autoPunctuationSpace});
  if(intro.length>5)throw new Error('前書きの改行・空行を減らして、5行以内に収めてください。');
  const lines=breakLines(body,indent,combineDigits,SPEC.rows,{font,autoPunctuationSpace}),pages=[];
  const linePitch=38,firstColumns=7,columns=15;
  const add=(cells,unit,x,y,size,role)=>cells.push({char:unit.display,source:unit.text,kind:unit.kind,italic:unit.italic,ruby:unit.ruby,rubyIndex:unit.rubyIndex,x,y,size,...(role==='body'?sizedCell(unit,size,x):{}),role});
  for(let cursor=0;cursor<lines.length;){
    const index=pages.length,first=index===0,odd=(index+(startSide==='even'?1:0))%2===0;
    const packed=packLines(lines,cursor,first?firstColumns:columns,SPEC.bodySize,linePitch),pageLines=packed.map(p=>p.line);cursor+=pageLines.length;
    const cells=[],right=first?330:(odd?SPEC.oddRight:SPEC.evenRight);
    pageLines.forEach((line,col)=>line.forEach((u,row)=>add(cells,u,right-packed[col].offset-SPEC.bodySize/2,SPEC.top+u.rowOffset*SPEC.pitch,SPEC.bodySize,'body')));
    const page={cells,lines:pageLines,index,side:odd?'odd':'even',layout:'reader'};
    if(first){
      headingPositions(textUnits(title,{combineDigits})).forEach(({unit:u,offset:n})=>add(cells,u,422,184+n*26,26,'title'));
      const name=textUnits(author,{combineDigits});headingPositions(name).forEach(({unit:u,offset:n})=>add(cells,u,name.some(c=>c.ruby)?388:400,873.635-headingLength(name)*22+n*22,22,'author'));
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
    const authorAdvance=u=>headingAdvance(u)*22;
    const x=596-index*pitch,authorTop=bottom-author.reduce((sum,u)=>sum+authorAdvance(u),0);
    const label=entry.reader&&author.length?textUnits('読者寄稿'):[];
    const labelTop=authorTop-18-label.length*14;
    const available=(label.length?labelTop:author.length?authorTop:bottom)-top-24;
    const titleSize=Math.min(22,available/Math.max(1,headingLength(title)));
    if(titleSize<14)throw new Error(`「${entry.title}」は目次の縦1列に収まりません。目次用のタイトルを短くしてください。`);
    headingPositions(title).forEach(({unit:u,offset:n})=>add(u,x+(22-titleSize)/2,top+n*titleSize,titleSize,'toc-title'));
    let authorY=authorTop;
    author.forEach(u=>{add(u,x,authorY,22,'toc-author');authorY+=authorAdvance(u);});
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
  const combined=cell.kind==='tcy',caption=cell.kind==='caption';
  const sideways=!caption&&(cell.kind==='sideways-digit'||cell.kind==='sideways-tight'||(!combined&&cell.kind!=='upright'&&isSideways(cell.char))),run=glyphRun(font,cell.char,caption||combined||sideways);
  let fontSize=cell.size;
  const advance=run.positions.reduce((n,p)=>n+p.xAdvance,0);
  if(combined)fontSize*=Math.min(1, font.unitsPerEm/Math.max(advance,1));
  const scale=fontSize/font.unitsPerEm;
  const width=run.positions.reduce((n,p)=>n+p.xAdvance,0)*scale;
  const pad=caption||cell.kind==='sideways-tight'?0:(cell.size-width)/2;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPEC.width} ${SPEC.height}" role="img" aria-label="${xml(label)}"><title>${xml(label)}</title><rect width="100%" height="100%" fill="white"/><defs>${Array.from(definitions.values(),({id,path:d})=>`<path id="${id}" d="${xml(d)}"/>`).join('')}</defs><g fill="#111111">${uses.join('')}</g>${(page.images||[]).map((r,i)=>{const id=glyphPrefix+'clip'+i,c=r.clip;return `${c?`<defs><clipPath id="${id}"><rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}"/></clipPath></defs>`:''}<image ${c?`clip-path="url(#${id})"`:''} href="${r.data}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/>`;}).join('')}${(page.rules||[]).map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.color}"/>`).join('')}</svg>`;
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
    for(const r of page.images||[]){const img=await (/^data:image\/png[;,]/i.test(r.data)?pdf.embedPng(r.data):pdf.embedJpg(r.data));if(r.clip){const c=r.clip;out.pushOperators(PDFLib.pushGraphicsState(),PDFLib.rectangle(c.x,SPEC.height-c.y-c.height,c.width,c.height),PDFLib.clip(),PDFLib.endPath());}out.drawImage(img,{x:r.x,y:SPEC.height-r.y-r.height,width:r.width,height:r.height});if(r.clip)out.pushOperators(PDFLib.popGraphicsState());}
    for(const r of page.rules||[])out.drawRectangle({x:r.x,y:SPEC.height-r.y-r.height,width:r.width,height:r.height,color:rgb(...[1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16)/255))});
    for(const cell of page.cells||[]){
      const selected=page.font||font,active=cell.italic&&selected.italicFont?selected.italicFont:selected;
      const pos=glyphPosition(selected,cell),drawFont=await embedded(active,pos.sideways||pos.combined||cell.kind==='caption');
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
export function paginateReader(options){return fitTemplate(paginateReaderTemplate(options),options.pageSettings,options.startSide);}
export function paginateToc(options){return fitTemplate(paginateTocLegacy(options),options.pageSettings,options.startSide);}






