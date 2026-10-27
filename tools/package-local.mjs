import {readFile,writeFile,stat,mkdir,cp,copyFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {movieHold} from './media-holds.mjs';
import {buildMovieChapters} from './media-chapters.mjs';

// A review build is deliberately separate from the final, fully accepted kit.
const preview=process.argv.includes('--review');
const root=process.cwd(),output=path.join(root,preview?'delivery-review':'delivery');
const ledger=JSON.parse(await readFile('qa/v2-production-ledger.json','utf8'));
if(!preview&&!ledger.complete)throw new Error('全量验收尚未通过，不能打包为完整交付。需要检查中版本时使用 --review。');
await stat('dist/index.html');
await mkdir(output,{recursive:true});
const catalogSources=new Set(['dist/media/catalog.json','public/media/catalog.json'].map(p=>path.resolve(p)));
const assetFilter=source=>!catalogSources.has(path.resolve(source));
await cp('dist',output,{recursive:true,filter:assetFilter});
// Media can finish while the application is building. Use the latest reviewed
// static catalog without rebuilding otherwise unchanged application code.
await cp('public/media',path.join(output,'media'),{recursive:true,filter:assetFilter});
const catalog=JSON.parse(await readFile('public/media/catalog.json','utf8'));
const holds=JSON.parse(await readFile('qa/v2-media-holds.json','utf8'));
const included=[],skipped=[],blocked=[];
for(const [id,entry] of Object.entries(catalog)){
 delete entry.video;
 let report,review;
 try{report=JSON.parse(await readFile(`media/films/${id}/report.json`,'utf8'));review=JSON.parse(await readFile(`media/films/${id}/review.json`,'utf8').catch(()=>'null'));}catch{continue;}
 const hold=movieHold(holds,id,report.sha256);
 if(hold){skipped.push(id);blocked.push(hold);continue;}
 const verified=review?.sha256===report.sha256&&review.visual==='passed'&&review.audio==='passed';
 if(report.width!==1920||report.height!==1080||Math.abs(report.fps-60)>.001||report.duration<90||report.duration>150||!report.completeDecode||report.traceHash!==entry.traceHash||(!preview&&!verified)){skipped.push(id);continue;}
 const productionInput=await readFile(`media/exports/${id}.film.json`);
 if(createHash('sha256').update(productionInput).digest('hex')!==report.inputSha256){skipped.push(id);continue;}
 const chapters=await buildMovieChapters(id,report,JSON.parse(productionInput.toString('utf8')),file=>readFile(`media/exports/${file}`));
 const viewingFiles=[['final.mp4','film.mp4'],['poster.png','poster.png'],['audio/captions.vtt','subtitles.vtt'],['audio/captions.srt','subtitles.srt'],['transcript.txt','transcript.txt'],['audio/voice.wav','voice.wav']];
 try{await Promise.all(viewingFiles.map(([source])=>stat(`media/films/${id}/${source}`)));}catch(error){if(preview){skipped.push(id);continue;}throw error;}
 const movie=await readFile(`media/films/${id}/final.mp4`);
 if(createHash('sha256').update(movie).digest('hex')!==report.sha256){if(preview){skipped.push(id);continue;}throw new Error(id+': 成片与核验报告不一致');}
 const dest=path.join(output,'media',id);
 const assets={};
 for(const [source,target] of viewingFiles){
  const buffer=source==='final.mp4'?movie:await readFile(`media/films/${id}/${source}`),digest=createHash('sha256').update(buffer).digest('hex'),extension=path.extname(target);
  const name=path.basename(target,extension)+'-'+digest.slice(0,16)+extension,location=path.join(dest,name);assets[target]=name;
  let existing;try{existing=await readFile(location);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing){if(createHash('sha256').update(existing).digest('hex')!==digest)throw new Error(id+': 已有素材校验不一致');continue;}
  const pending=location+'.copying';await writeFile(pending,buffer);await rename(pending,location);
 }
 entry.video={src:`media/${id}/${assets['film.mp4']}`,poster:`media/${id}/${assets['poster.png']}`,subtitles:`media/${id}/${assets['subtitles.vtt']}`,transcript:`media/${id}/${assets['transcript.txt']}`,duration:report.duration,reviewStatus:verified?'reviewed':'preview',chapters};
 included.push({id,sha256:report.sha256,bytes:movie.length,duration:report.duration,reviewed:verified});
}
await writeFile(path.join(output,'media/catalog.building.json'),JSON.stringify(catalog,null,2));
await rename(path.join(output,'media/catalog.building.json'),path.join(output,'media/catalog.json'));
await mkdir(path.join(output,'tools'),{recursive:true});
await copyFile('tools/local-server.mjs',path.join(output,'tools/local-server.mjs'));
// Windows PowerShell 5.1 requires BOM to decode the Chinese messages reliably.
const launcher=(await readFile('tools/start-local.ps1','utf8')).replace(/^\uFEFF/,'');
await writeFile(path.join(output,'tools/start-local.ps1'),'\uFEFF'+launcher);
await writeFile(path.join(output,'打开体验馆.cmd'),'@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start-local.ps1" -PackageRoot "%~dp0."\r\nif errorlevel 1 pause\r\n');
await writeFile(path.join(output,'使用说明.txt'),`算法奇境 2.0${preview?' · 制作中审查版':''}\n\n双击“打开体验馆.cmd”打开。此文件夹内的页面、漫画、已收录视频和字幕均可离线观看；启动需要本机已安装 Node.js。服务只监听本机127.0.0.1。\n\n收藏和学习记录保存在当前浏览器。与公开版迁移时，在“学习足迹”导出、导入记录；不会自动同步。\n\n${preview?'当前为制作中审查版，视频收录数量见交付状态；完整视听验收尚未通过。已生成的样片在播放器前明确标记。':'此包通过制作台账的全量验收。'}\n实际数量和文件指纹见“交付状态.json”。\n`);
await writeFile(path.join(output,'交付状态.json'),JSON.stringify({builtAt:new Date().toISOString(),status:preview?'制作中审查版':'全量验收版',complete:!preview,counts:ledger.totals,films:included,skipped,blocked},null,2));
console.log(JSON.stringify({output,preview,comics:Object.keys(catalog).length*3,films:included.length,skipped,knownDefectsExcluded:blocked.length}));
