import {lessonById} from '../src/content/lessons';
import {byId} from '../src/content/catalog';
import {defaults} from '../src/engine/utils';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
for(const lesson of Object.values(lessonById)){
 const a=byId[lesson.algorithmId],c=lesson.teachingCase,p=normalizeParams(a,{...defaults(a),...c.params}),i=normalizeInput(c.input),changed=[];
 for(const [k,v] of Object.entries(c.params))if(p[k]!==v)changed.push({key:k,case:v,normalized:p[k]});
 for(const [k,v] of Object.entries(c.input))if(JSON.stringify(i[k])!==JSON.stringify(v))changed.push({inputKey:k,case:v,normalized:i[k]});
 if(changed.length)console.log(JSON.stringify({id:a.id,changed}));
}
