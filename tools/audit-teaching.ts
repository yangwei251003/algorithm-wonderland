import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {algorithms,groupFor} from '../src/content/catalog';
import {lessonById} from '../src/content/lessons';
import {defaults} from '../src/engine/utils';
import {replayTrace,stateAtTrace,teachingJSON} from '../src/engine/teaching';
import type {Runner} from '../src/engine/types';
const groups:Record<string,Record<string,Runner>>={core:(await import('../src/algorithms/core')).runners,intelligence:(await import('../src/algorithms/intelligence')).runners,world:(await import('../src/algorithms/world')).runners};
const rows=[];
for(const a of algorithms){
 const lesson=lessonById[a.id];if(!lesson){rows.push({id:a.id,name:a.name,status:'missing',issues:['原理课文尚未提交']});continue;}
 const issues:string[]=[],begin=performance.now();
 try{
  const c=lesson.teachingCase,run=await groups[groupFor(a.category)][a.id](c.input,{...defaults(a),...c.params},c.seed),trace=run.trace;
  if(!trace?.complete)issues.push('缺少完整实际计算记录');
  if(lesson.rules.length<2)issues.push('规则拆分不足');
  if(lesson.references.filter(r=>r.role==='visual').length<3)issues.push('未齐3份已查看的同类作品');
  if(!lesson.references.some(r=>r.role==='definition'))issues.push('缺少独立原理依据');
  for(const rule of lesson.rules){if(!rule.sourceIds.length||rule.sourceIds.some(id=>!lesson.references.some(r=>r.id===id)))issues.push('规则来源无法解析：'+rule.id);}
  for(const kind of ['next','alternative','change'])if(!lesson.questions.some(q=>q.kind===kind&&q.explanation.trim().length>0&&q.correct>=0&&q.correct<q.options.length))issues.push('缺少完整理解题：'+kind);
  for(const m of lesson.analogy.mappings)if(!m.ruleIds.length||m.ruleIds.some(id=>!lesson.rules.some(r=>r.id===id)))issues.push('类比没有对应到有效规则');
  if(!lesson.analogy.limit||lesson.analogy.mappings.length<2)issues.push('类比或边界未完成');
  if(trace){
   if(!trace.events.length)issues.push('没有执行事件');
   if(teachingJSON(replayTrace(trace))!==teachingJSON(trace.finalState))issues.push('重放与最终状态不一致');
   if(teachingJSON(stateAtTrace(trace,trace.events.length-1))!==teachingJSON(trace.finalState))issues.push('检查点查阅与最终状态不一致');
   for(const e of trace.events){
    if(!lesson.rules.some(r=>r.id===e.ruleId))issues.push('执行事件引用未定义规则：'+e.ruleId);
    if(!e.action||!e.explanation)issues.push('步骤缺少行动或依据');
    if(!e.scene&&!run.frames[e.frameIndex])issues.push('步骤没有对应画面');
    if(e.parentId&&!trace.events.some(p=>p.id===e.parentId))issues.push('步骤分层指向不存在的父事件');
   }
   const again=await groups[groupFor(a.category)][a.id](c.input,{...defaults(a),...c.params},c.seed);
   if(teachingJSON(trace)!==teachingJSON(again.trace))issues.push('相同输入和种子不能重现同一记录');
  }
  rows.push({id:a.id,name:a.name,status:issues.length?'needs-review':'contract-pass',events:trace?.events.length??0,frames:run.frames.length,checkpoints:trace?.checkpoints?.length??0,visualSources:lesson.references.filter(r=>r.role==='visual').length,traceHash:trace?createHash('sha256').update(teachingJSON(trace)).digest('hex'):null,elapsedMs:Math.round(performance.now()-begin),issues:[...new Set(issues)]});
 }catch(error){rows.push({id:a.id,name:a.name,status:'error',issues:[String(error)]});}
}
const report={checkedAt:new Date().toISOString(),scope:'教学样例契约、来源引用、状态重放及固定种子复现；不代替独立数学基准、视觉审查或真人试学',total:algorithms.length,passed:rows.filter(r=>r.status==='contract-pass').length,rows};
await mkdir('qa',{recursive:true});await writeFile('qa/v2-teaching-contract.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({total:report.total,passed:report.passed,missing:rows.filter(r=>r.status==='missing').length,needsReview:rows.filter(r=>r.status==='needs-review').length,errors:rows.filter(r=>r.status==='error')}));
if(process.argv.includes('--strict')&&report.passed!==84)process.exitCode=1;
