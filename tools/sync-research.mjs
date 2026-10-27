import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const project=process.cwd();
const data=JSON.parse(await readFile(path.join(project,'docs/research-v2/research-index.json'),'utf8'));
const entries=Array.isArray(data)?data:data.algorithms??data.entries??data.items??[];
const map={};
for(const item of entries){const refs=[...(item.visualReferences??[]),...(item.definitionReferences??[])];if(refs.length)map[item.id]=refs;}
await mkdir(path.join(project,'src/content/lessons'),{recursive:true});
await writeFile(path.join(project,'src/content/lessons/references.generated.ts'),'// Generated from individually checked research records.\nimport type {ResearchReference} from "../../engine/teaching";\nexport const referencesById:Record<string,ResearchReference[]>='+JSON.stringify(map,null,2)+';\n');
console.log('已同步 '+Object.keys(map).length+' 项有核查记录的来源。');
