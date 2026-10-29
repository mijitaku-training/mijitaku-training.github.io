import {paginateWithImages} from './inline-layout.js?v=57';
import {pageGeometry} from './page-settings.js?v=57';
import {SPEC,paginate,paginateAfterword,paginateReader,paginateToc,missingCharacters} from './layout.js?v=57';

export function imagePlacement(width,height,fit='contain',SPEC=pageGeometry()){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('画像の大きさを読み取れませんでした。');
  const scale=fit==='cover'?Math.max(SPEC.width/width,SPEC.height/height):Math.min(SPEC.width/width,SPEC.height/height);
  const w=width*scale,h=height*scale;
  return {x:(SPEC.width-w)/2,y:(SPEC.height-h)/2,width:w,height:h};
}
export function buildBook(items,{font,resolveFont,startSide='odd',title='身仕度_まとめ',pageSettings}={}){
  if(!items.length)throw new Error('本文か画像を追加してください。');
  const pages=[],sections=[];
  for(const [number,item] of items.entries()){
    const itemTitle=item.title?.trim()||(item.kind==='text'?'タイトル未入力':'画像ページ');
    const start=pages.length;
    const effective=item.pageSettings||pageSettings,geometry=pageGeometry(effective);
    if(item.kind==='blank'){
      pages.push({width:geometry.width,height:geometry.height,kind:'blank',cells:[],index:pages.length,itemId:item.id,itemTitle:'白紙ページ',itemPage:1});
    }else if(item.kind==='text'||item.kind==='toc'){
      const itemFont=resolveFont?resolveFont(item):font;
      let doc;try{doc=(item.kind==='toc'?paginateToc:item.layout==='afterword'?paginateAfterword:item.inlineImages?.length?paginateWithImages:item.layout==='reader'?paginateReader:paginate)({...item,font:itemFont,pageSettings:effective,startSide:(start+(startSide==='even'?1:0))%2?'even':'odd'});}catch(error){throw new Error(`${number+1}番目「${itemTitle}」：${error.message}`);}
      if(itemFont){const missing=missingCharacters(doc,itemFont);if(missing.length)throw new Error(`「${itemTitle}」のフォントにない文字：${missing.slice(0,12).join(' ')}。文字かフォントを変更してください。`);}
      for(const p of doc.pages)pages.push({...p,font:itemFont,index:pages.length,itemId:item.id,itemTitle,itemPage:p.index+1});
    }else if(item.kind==='pdf'){
      if(!item.pdf?.pages?.length||!item.pdf.data)throw new Error(`「${itemTitle}」のPDFを選び直してください。`);
      item.pdf.pages.forEach((image,pdfIndex)=>{
        // Use the book's page width while preserving the source page's proportions.
        // Different PDF point sizes otherwise appear as smaller sheets in a mixed book.
        const width=geometry.width,sourceWidth=image.pageWidth||image.width,sourceHeight=image.pageHeight||image.height;
        const height=width*(item.pdfRatio?(item.pdfRatio.mode==='silver'?Math.SQRT2:item.pdfRatio.ratioHeight/item.pdfRatio.ratioWidth):item.pdfFit==='cover'?geometry.height/geometry.width:sourceHeight/sourceWidth);
        pages.push({width,height,kind:'image',image,placement:imagePlacement(image.pageWidth||image.width,image.pageHeight||image.height,item.pdfFit||'contain',{width,height}),clip:{x:0,y:0,width,height},pdfFit:item.pdfFit||'contain',pdfSource:item.pdf,pdfIndex,cells:[],index:pages.length,itemId:item.id,itemTitle,itemPage:pdfIndex+1});
      });
    }else if(item.kind==='image'){
      if(!item.image?.data?.startsWith('data:image/jpeg;base64,'))throw new Error(`「${itemTitle}」の画像を選び直してください。`);
      // Imported artwork is a whole page, not a block inside the text margins.
      const clip={x:0,y:0,width:geometry.width,height:geometry.height};
      const placement=imagePlacement(item.image.width,item.image.height,item.fit,clip);placement.x+=clip.x;placement.y+=clip.y;
      pages.push({width:geometry.width,height:geometry.height,clip,kind:'image',image:item.image,placement,cells:[],index:pages.length,itemId:item.id,itemTitle,itemPage:1});
    }else throw new Error('未対応のページです。');
    sections.push({id:item.id,title:itemTitle,start:start+1,count:pages.length-start,kind:item.kind});
    if(pages.length>300)throw new Error('この試作版では、まとめるページ数を300ページ以内にしてください。');
  }
  return {title:items.length===1?(items[0].title||'身仕度_本文'):title,author:Array.from(new Set(items.filter(i=>i.kind==='text').map(i=>i.author).filter(Boolean))).join('、'),pages,sections};
}
export function moveItem(items,id,direction){
  const result=[...items],index=result.findIndex(i=>i.id===id),next=index+direction;
  if(index<0||next<0||next>=result.length)return result;
  [result[index],result[next]]=[result[next],result[index]];return result;
}
let imageSvgSerial=0;
export function imageSvg(page){
  const r=page.placement,SPEC=page,c=page.clip,frameId=`mijitaku-image-${++imageSvgSerial}-frame`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPEC.width} ${SPEC.height}" role="img" aria-label="画像ページのプレビュー"><rect width="100%" height="100%" fill="white"/><defs><clipPath id="${frameId}"><rect x="${c?.x||0}" y="${c?.y||0}" width="${c?.width||SPEC.width}" height="${c?.height||SPEC.height}"/></clipPath></defs><image clip-path="url(#${frameId})" href="${page.image.data}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" preserveAspectRatio="none"/></svg>`;
}
export async function readImageFile(file){
  if(file.size>25*1024*1024)throw new Error('画像は1枚25MB以下にしてください。');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('画像を開けませんでした。JPEG・PNG・WebPなどで選び直してください。'));image.src=url;});
    const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
    const width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('この端末で画像を処理できませんでした。');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
    return {data:canvas.toDataURL('image/jpeg',.94),width,height,name:file.name};
  }finally{URL.revokeObjectURL(url);}
}








