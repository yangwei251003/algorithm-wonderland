import {readFile,writeFile,readdir,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.argv[2]??'public/media',catalog={},integrity=[];
await mkdir(out,{recursive:true});
for(const id of await readdir('media/comics')){
 let review,data;
 try{review=JSON.parse(await readFile(`media/comics/${id}/review.json`,'utf8'));data=JSON.parse(await readFile(`media/exports/${id}.json`,'utf8'));}catch{continue;}
 if(review.algorithmId!==id||review.traceHash!==data.traceHash||review.lessonVersion!==data.lesson.version)throw new Error(id+': 漫画审查与教学版本不一致');
 const comics=[];
 for(const role of ['analogy','rules','summary']){
  const checked=review.comics.find(c=>c.role===role&&c.status==='passed');
  if(!checked)continue;
  if(checked.file!==role+'.png')throw new Error(id+': 正式图片必须使用固定角色文件名');
  const source=`media/comics/${id}/${checked.file}`,buffer=await readFile(source);
  if(buffer.length<1024||buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(id+': 无效PNG');
  await mkdir(`${out}/${id}`,{recursive:true});
  await copyFile(source,`${out}/${id}/comic-${role}.png`);
  comics.push({role,src:`media/${id}/comic-${role}.png`,alt:checked.alt});
  integrity.push({id,role,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});
 }
 if(comics.length===3)catalog[id]={algorithmId:id,lessonVersion:data.lesson.version,traceHash:data.traceHash,comics};
}
await writeFile(`${out}/catalog.json`,JSON.stringify(catalog,null,2));
await writeFile('qa/v2-comic-integrity.json',JSON.stringify({checkedAt:new Date().toISOString(),exhibits:Object.keys(catalog).length,images:integrity.length,files:integrity},null,2));
console.log(JSON.stringify({exhibits:Object.keys(catalog).length,images:integrity.length,output:out}));
