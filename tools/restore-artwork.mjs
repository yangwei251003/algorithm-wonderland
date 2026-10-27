import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await readFile(path.join(root,'public/media/catalog.json'),'utf8'));
const requested=process.argv.slice(2);
const ids=requested.length?requested:Object.keys(catalog);
let restored=0;
for(const id of ids){
 if(!/^[a-z0-9-]+$/.test(id)||!catalog[id])throw new Error('Unknown exhibit: '+id);
 for(const role of ['analogy','rules','summary']){
  const source=path.join(root,'public/media',id,`comic-${role}.png`);
  const target=path.join(root,'media/comics',id,`${role}.png`);
  const bytes=await readFile(source);
  let existing;
  try{existing=await readFile(target);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing&&!existing.equals(bytes))throw new Error(`Existing artwork differs; preserve and review it before restoring: ${id}/${role}`);
  if(!existing){await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
  const check=await readFile(target);
  if(createHash('sha256').update(check).digest('hex')!==createHash('sha256').update(bytes).digest('hex'))throw new Error('Artwork verification failed');
  restored++;
 }
}
console.log(`Verified ${restored} original comic files for film preparation.`);
