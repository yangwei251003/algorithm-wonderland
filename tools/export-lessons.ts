import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {lessons} from '../src/content/lessons';
import {byId,groupFor} from '../src/content/catalog';
import {defaults} from '../src/engine/utils';
import {replayTrace,teachingJSON} from '../src/engine/teaching';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
const ids=process.argv.slice(2);
await mkdir('media/exports',{recursive:true});
for(const lesson of lessons.filter(l=>!ids.length||ids.includes(l.algorithmId))){
 const algorithm=byId[lesson.algorithmId],group=groupFor(algorithm.category);
 const module=group==='core'?await import('../src/algorithms/core'):group==='intelligence'?await import('../src/algorithms/intelligence'):await import('../src/algorithms/world');
 const run=await module.runners[algorithm.id](lesson.teachingCase.input,{...defaults(algorithm),...lesson.teachingCase.params},lesson.teachingCase.seed);
 const browserRun=await module.runners[algorithm.id](normalizeInput(lesson.teachingCase.input),normalizeParams(algorithm,{...defaults(algorithm),...lesson.teachingCase.params}),lesson.teachingCase.seed);
 if(teachingJSON(run.trace)!==teachingJSON(browserRun.trace))throw new Error(algorithm.id+': 网页输入校验改变了教学案例的真实计算，先修正控件范围/选择项');
 if(!run.trace?.complete)throw new Error(algorithm.id+': 完整真实计算记录尚未就绪');
 if(teachingJSON(replayTrace(run.trace))!==teachingJSON(run.trace.finalState))throw new Error(algorithm.id+': 状态重放不一致');
 if(lesson.references.filter(r=>r.role==='visual').length<3)throw new Error(algorithm.id+': 3份同类视觉调研未齐');
 const traceHash=createHash('sha256').update(teachingJSON(run.trace)).digest('hex');
 const payload={schemaVersion:1,algorithm:{id:algorithm.id,name:algorithm.name,subtitle:algorithm.subtitle},lesson,run,traceHash};
 await writeFile('media/exports/'+algorithm.id+'.json',teachingJSON(payload,2));
 console.log(JSON.stringify({id:algorithm.id,events:run.trace.events.length,frames:run.frames.length,metrics:run.metrics,traceHash}));
}
