import {readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
const ids=process.argv.slice(2);
if(!ids.length)throw new Error('请指定已完成逐项审查的展项ID');
for(const id of ids){
 if(!/^[a-z0-9-]+$/.test(id))throw new Error('Invalid id');
 const data=JSON.parse(await readFile(`media/exports/${id}.json`,'utf8'));
 const script=JSON.parse(await readFile(`media/scripts/${id}.json`,'utf8'));
 const artwork={};for(const role of ['analogy','rules','summary']){const file=path.resolve(`media/comics/${id}/${role}.png`);try{await access(file);artwork[role]=file;}catch{}}
 const film={...data,...script,artwork};
 await writeFile(`media/exports/${id}.film.json`,JSON.stringify(film,null,2));
 console.log(`${id}: ${script.beats.length} 段旁白 / ${script.beats.reduce((n,b)=>n+b.text.length,0)} 字 / ${Object.keys(artwork).length} 张已落盘图片（正式渲染另核验审查记录）`);
}
