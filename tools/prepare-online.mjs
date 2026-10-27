import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
sharp.concurrency(1);
const catalog=JSON.parse(await readFile('public/media/catalog.json','utf8'));
if(Object.keys(catalog).length!==84)throw new Error('Expected 84 online exhibits');
const images=Object.values(catalog).flatMap(item=>item.comics),integrity=[];
let next=0;
await Promise.all(Array.from({length:4},async()=>{
 while(next<images.length){
  const comic=images[next++],source=`public/${comic.src}`,preview=comic.src.replace(/\.png$/,'.webp'),destination=`public/${preview}`;
  if(preview===comic.src)throw new Error('Expected original PNG artwork');
  const original=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  await sharp(source).webp({lossless:true,effort:0}).toFile(destination);
  const decoded=await sharp(destination).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(original.info.width!==decoded.info.width||original.info.height!==decoded.info.height||!original.data.equals(decoded.data))throw new Error('Lossless preview differs from original pixels: '+comic.src);
  comic.preview=preview;
  integrity.push({source:comic.src,preview,originalBytes:(await stat(source)).size,previewBytes:(await stat(destination)).size,sha256:createHash('sha256').update(await readFile(destination)).digest('hex'),pixelIdentical:true});
 }
}));
for(const [id,item] of Object.entries(catalog)){
 const script=JSON.parse(await readFile(`media/scripts/${id}.json`,'utf8'));
 if(!script.beats?.length||item.comics.length!==3)throw new Error('Incomplete online lesson: '+id);
 const transcript=script.beats.map(beat=>`${beat.title}\n${beat.text}`).join('\n\n');
 await mkdir(`public/media/${id}`,{recursive:true});
 await writeFile(`public/media/${id}/transcript.txt`,transcript+'\n');
 item.reading={transcript:`media/${id}/transcript.txt`};
 delete item.video;
}
await writeFile('public/media/catalog.json',JSON.stringify(catalog,null,2)+'\n');
await writeFile('public/comic-previews.json',JSON.stringify({mode:'lossless-webp',images:integrity,originalBytes:integrity.reduce((n,v)=>n+v.originalBytes,0),previewBytes:integrity.reduce((n,v)=>n+v.previewBytes,0)},null,2)+'\n');
await writeFile('public/online-preview.json',JSON.stringify({version:'2.0-online-preview',exhibits:84,comics:252,interactive:16,transcripts:84,hostedFilms:0,fullAudiovisualReviewed:0},null,2)+'\n');
console.log('Online preview prepared: 84 exhibits, 252 comics, 16 interactive films, 84 transcripts.');
