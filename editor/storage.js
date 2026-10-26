import {normalizePageSettings} from './page-settings.js?v=21';
const FORMAT='mijitaku-editor',VERSION=1;
let database;
function openDb(){
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('このブラウザでは自動保存を使えません。編集データを保存してください。'));return;}
    const req=indexedDB.open('mijitaku-editor',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('drafts');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error('別のタブを閉じてからお試しください。'));
  }).catch(error=>{database=null;throw error;});return database;
}
// Store large projects as UTF-8 binary, not a giant structured-cloned string tree.
// Compression is lossless; exported backups keep their existing JSON format.
async function packProject(data){
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const gzip=typeof CompressionStream==='function'&&typeof DecompressionStream==='function';
  const stream=gzip?blob.stream().pipeThrough(new CompressionStream('gzip')):blob.stream();
  return {storageFormat:'mijitaku-packed-v1',encoding:gzip?'gzip':'utf8',bytes:new Uint8Array(await new Response(stream).arrayBuffer())};
}
async function unpackProject(record){
  if(record?.storageFormat!=='mijitaku-packed-v1')return record;
  let stream=new Blob([record.bytes]).stream();
  if(record.encoding==='gzip')stream=stream.pipeThrough(new DecompressionStream('gzip'));
  else if(record.encoding!=='utf8')throw new Error('下書きの保存形式を読み込めません。');
  return JSON.parse(await new Response(stream).text());
}
export async function saveDraft(data){const packed=await packProject(data),db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(packed,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存が中断されました。'));});}
export const readDraft=()=>readRecord('current');
async function readRecord(key){const db=await openDb();const record=await new Promise((resolve,reject)=>{const req=db.transaction('drafts').objectStore('drafts').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});return unpackProject(record);}
export const readRecovery=()=>readRecord('before-restore');
export const readBackupAction=()=>readRecord('backup-action');
export async function saveBackupAction(value){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(value,'backup-action');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存が中断されました。'));});}
// Both records commit together. On quota/transaction failure, neither is changed.
export async function commitRestoration(next,previous){
  const packedPrevious=await packProject(previous),packedNext=await packProject(next);
  const db=await openDb();await new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('復元前の退避に失敗しました。'));
    try{store.put(packedPrevious,'before-restore');store.put(packedNext,'current');}catch(error){tx.abort();reject(error);}
  });
}
export function backupFilename(base,date=new Date()){
  const pad=(n,w=2)=>String(n).padStart(w,'0');
  return `${base}_バックアップ_${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(),3)}.json`;
}
export function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
export function base64ToBytes(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export function makeProject(state){return {format:FORMAT,version:VERSION,savedAt:new Date().toISOString(),...state};}
export function validateProject(input){
  const fail=()=>{throw new Error('このファイルは対応する身仕度の編集データではありません。');};
  if(!input||input.format!==FORMAT||input.version!==VERSION||!Array.isArray(input.items)||!input.items.length||input.items.length>300)fail();
  const str=(s,max)=>{if(typeof s!=='string'||s.length>max)fail();return s;};
  const seen=new Set();
  const items=input.items.map((i,index)=>{
    if(!i||typeof i!=='object')fail();const id=str(i.id,100);if(seen.has(id))fail();seen.add(id);
    const title=str(i.title,1000);
    const setting=i.pageSettings?{pageSettings:normalizePageSettings(i.pageSettings)}:{};
    if(i.fontChoice!==undefined){if(!['legacy','mincho','gothic','custom'].includes(i.fontChoice))fail();setting.fontChoice=i.fontChoice;}
    if(i.italicFont!==undefined){if(!['same','mincho','gothic'].includes(i.italicFont))fail();setting.italicFont=i.italicFont;}
    if(i.fontData){const data=str(i.fontData.data,28000000);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data))fail();setting.fontData={name:str(i.fontData.name,500),data};}
    if(i.fontChoice==='custom'&&!setting.fontData)fail();
    let pdfRatio;
    if(i.pdfRatio){const r=normalizePageSettings(i.pdfRatio);pdfRatio={mode:r.mode,ratioWidth:r.ratioWidth,ratioHeight:r.ratioHeight};}
    if(i.kind==='blank')return {...setting,id,kind:'blank',title:'白紙ページ'};
    if(i.kind==='text'){
      if(i.layout&&!['afterword','reader'].includes(i.layout))fail();
      return {...setting,id,kind:'text',title,author:str(i.author,1000),body:str(i.body,200000),preface:str(i.preface||'',2000),indent:i.indent!==false,combineDigits:i.combineDigits!==false,autoPunctuationSpace:i.autoPunctuationSpace===true,...(i.layout?{layout:i.layout}:{})};
    }
    if(i.kind==='toc'){
      if(!Array.isArray(i.entries)||i.entries.length>10)fail();
      return {...setting,id,kind:'toc',title,entries:i.entries.map(e=>({title:str(e.title,1000),author:str(e.author,1000),reader:e.reader===true}))};
    }
    if(i.kind==='pdf'){
      const source=i.pdf;if(!source||!Array.isArray(source.pages)||!source.pages.length||source.pages.length>100)fail();
      const data=str(source.data,35000000);if(!/^JVBER[A-Za-z0-9+/]*={0,2}$/.test(data))fail();
      let total=0;
      const pages=source.pages.map(im=>{
        if(!im||!Number.isInteger(im.width)||!Number.isInteger(im.height)||im.width<1||im.height<1||im.width>2400||im.height>2400)fail();
        const image=str(im.data,40000000);total+=image.length;if(total>100*1024*1024||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))fail();
        const size=im.pageWidth!==undefined||im.pageHeight!==undefined;
        if(size&&(!Number.isFinite(im.pageWidth)||!Number.isFinite(im.pageHeight)||im.pageWidth<=0||im.pageHeight<=0||im.pageWidth>14400||im.pageHeight>14400))fail();
        return {...(size?{pageWidth:im.pageWidth,pageHeight:im.pageHeight}:{}),data:image,width:im.width,height:im.height,name:str(im.name,600),raster:im.raster===true};
      });
      return {...setting,...(pdfRatio?{pdfRatio}:{}),id,kind:'pdf',title,author:str(i.author||'',1000),...(i.tocInclude===false?{tocInclude:false}:{}),pdf:{name:str(source.name,500),data,pages}};
    }
    if(i.kind==='image'){
      const im=i.image;if(!im||!Number.isInteger(im.width)||!Number.isInteger(im.height)||im.width<1||im.height<1||im.width>2400||im.height>2400)fail();
      const data=str(im.data,40000000);if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))fail();
      return {...setting,id,kind:'image',title,fit:i.fit==='cover'?'cover':'contain',image:{data,width:im.width,height:im.height,name:str(im.name,500)}};
    }
    fail();
  });
  let font=null;
  if(input.font){const data=str(input.font.data,28000000);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data))fail();font={name:str(input.font.name,500),data};}
  return makeProject({pageSettings:normalizePageSettings(input.pageSettings),items,selectedId:seen.has(input.selectedId)?input.selectedId:items[0].id,startSide:input.startSide==='even'?'even':'odd',pdfName:str(input.pdfName||'',200),font});
}
