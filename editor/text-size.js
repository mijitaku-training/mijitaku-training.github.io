// Formatting stays in body text, so existing draft/backup machinery preserves it.
export const sizeTagPattern=/\[Q=([0-9]+(?:\.[0-9]+)?)\]|\[\/Q\]/g;
export function changeTextSize(source,start,end,q){
  if(q!==null&&(!Number.isFinite(q)||q<8||q>64))throw new Error('級数は8〜64Qで入力してください。');
  const tags=Array.from(source.matchAll(sizeTagPattern));
  // With a caret, reset or replace the enclosing size span.
  if(start===end){
    let opening;
    for(const tag of tags){
      if(tag[1])opening=tag;
      else if(opening&&start>=opening.index&&start<=tag.index+tag[0].length){start=opening.index+opening[0].length;end=tag.index;break;}
    }
    if(start===end)throw new Error('サイズを変える文章を選択してください。');
  }
  let text='',sizes=[],active=null,cursor=0;
  const offsets=new Array(source.length+1);
  for(const tag of tags){
    for(;cursor<tag.index;cursor++){offsets[cursor]=text.length;text+=source[cursor];sizes.push(active);}
    for(let n=0;n<tag[0].length;n++)offsets[cursor++]=text.length;
    if(tag[1]){if(active!==null)throw new Error('級数の入れ子を解除してください。');active=Number(tag[1]);}
    else{if(active===null)throw new Error('級数の開始指定がありません。');active=null;}
  }
  if(active!==null)throw new Error('級数の指定が閉じていません。');
  for(;cursor<source.length;cursor++){offsets[cursor]=text.length;text+=source[cursor];sizes.push(null);}
  offsets[source.length]=text.length;
  start=offsets[start];end=offsets[end];
  if(start===end)throw new Error('サイズを変える文章を選択してください。');
  // Keep ruby, combined characters and italics intact; never split their markup.
  const groups=/｜[^｜《》\n]+《[^《》\n]*》|《[^｜《》\n]+《[^《》\n]*》》|\[\[[^\n]*?\]\]|\{[^{}\n]*\}|｛[^｛｝\n]*｝/g;
  for(const m of text.matchAll(groups))if(start<m.index+m[0].length&&end>m.index&&(start>m.index||end<m.index+m[0].length))throw new Error('ルビ・組文字・斜体は、指定の記号も含めて全体を選択してください。');
  for(let i=start;i<end;i++)sizes[i]=q;
  let result='',selectedStart=0,selectedEnd=0;
  for(let i=0;i<text.length;){
    if(text[i]==='\n'||text[i]==='\r'){if(i===start)selectedStart=result.length;result+=text[i++];if(i===end)selectedEnd=result.length;continue;}
    const size=sizes[i];let j=i+1;
    while(j<text.length&&text[j]!=='\n'&&text[j]!=='\r'&&sizes[j]===size)j++;
    const prefix=size===null?'':`[Q=${size}]`,suffix=size===null?'':'[/Q]';
    if(start>=i&&start<j)selectedStart=result.length+prefix.length+start-i;
    if(end>i&&end<=j)selectedEnd=result.length+prefix.length+end-i;
    result+=prefix+text.slice(i,j)+suffix;i=j;
  }
  if(result.length>50000)throw new Error('指定を含めて50,000字以内にしてください。');
  return {text:result,start:selectedStart,end:selectedEnd};
}
