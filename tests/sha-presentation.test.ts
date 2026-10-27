import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sha256Detailed,sha256Teaching} from '../src/algorithms/intelligence-sha256';
import {ShaPrinciples,projectSha,canShowSha,shaWordBits,shaFocusByte} from '../src/components/ShaPrinciples';
import {sceneForTraceEvent} from '../src/engine/traceScene';
import {teachingJSON,stateAtTrace} from '../src/engine/teaching';
const abc=sha256Detailed('abc');
const p=(id:number)=>projectSha(abc.trace,abc.trace.events[id])!;

test('SHA byte, padding and big-endian word diagrams read actual values',()=>{
 assert.deepEqual(p(0).bytes,[0x61,0x62,0x63]);assert.equal(p(0).bitLength,24);assert.deepEqual(p(0).padded,[]);
 assert.equal(p(1).padded.length,64);assert.deepEqual(p(1).padded.slice(0,4),[0x61,0x62,0x63,0x80]);assert.deepEqual(p(1).padded.slice(-8),[0,0,0,0,0,0,0,24]);
 assert.equal(p(2).mode,'read');assert.equal(p(2).offset,0);assert.equal(p(2).result,'0x61626380');assert.equal(p(17).offset,60);assert.equal(p(17).result,'0x00000018');
 assert.deepEqual(shaWordBits('0x80000001'),[1,...Array(30).fill(0),1]);
});
test('SHA W expansion keeps recorded zero/nonzero sigma terms and source words',()=>{
 assert.equal(p(18).mode,'expand');assert.equal(p(18).wordIndex,16);assert.equal(p(18).values['σ1'],'0x00000000');
 const d=p(19);assert.equal(d.wordIndex,17);assert.equal(d.words['W[15]'],'0x00000018');assert.equal(d.values['ROTR17(y)'],'0x000c0000');assert.equal(d.values['ROTR19(y)'],'0x00030000');assert.equal(d.values['σ1'],'0x000f0000');assert.equal(d.result,'0x000f0000');
 assert.equal(shaFocusByte(String(d.values['σ1'])),1);assert.equal(shaFocusByte('0x00000000'),0);assert.equal(shaFocusByte('0x00000001'),3);
});
test('SHA Ch/Maj display the same old register bits as the recorded round',()=>{
 const t1=p(67),t2=p(68);assert.equal(t1.mode,'t1');assert.equal(t2.mode,'t2');assert.equal(t1.oldRegisters[4],'0x510e527f');assert.equal(t1.values.Ch,'0x1f85c98c');assert.equal(t1.result,'0x54da50e8');assert.equal(t2.values.Maj,'0x3a6fe667');assert.equal(t2.result,'0x08909ae5');
 for(const d of [t1,t2]){const start=d.mode==='t1'?4:0,src=d.oldRegisters.slice(start,start+3).map(shaWordBits),out=shaWordBits(String(d.values[d.mode==='t1'?'Ch':'Maj']));out.forEach((v,i)=>assert.equal(v,d.mode==='t1'?src[src[0][i]?1:2][i]:Number(src[0][i]+src[1][i]+src[2][i]>=2)));}
});
test('SHA simultaneous update and chain addition preserve distinct old and new records',()=>{
 const d=p(69);assert.equal(d.oldRegisters[0],'0x6a09e667');assert.equal(d.registers[0],'0x5d6aebcd');assert.equal(d.registers[1],d.oldRegisters[0]);assert.equal(d.registers[4],'0xfa2a4622');
 const c=p(259);assert.equal(c.oldChain[0],'0x6a09e667');assert.equal(c.registers[0],'0x506e3058');assert.equal(c.chain[0],'0xba7816bf');assert.equal(p(260).digest,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('SHA changed input, backward seek and later block initialization do not reuse final state',()=>{
 for(const text of ['', '中文','a'.repeat(65)]){
  const run=sha256Detailed(text),trace=run.trace,initial=projectSha(trace,trace.events[0])!;assert.deepEqual(initial.bytes,Array.from(new TextEncoder().encode(text)));assert.equal(initial.digest,'');
  for(const event of trace.events.filter(e=>e.phase==='初始化寄存器')){const d=projectSha(trace,event)!;assert.equal(d.mode,'initialize');assert.deepEqual(d.registers,stateAtTrace(trace,Number(event.id)).chain);}
  projectSha(trace,trace.events.at(-1)!);assert.equal(projectSha(trace,trace.events[0])!.digest,'');assert.deepEqual(projectSha(trace,trace.events[0])!.padded,[]);
 }
 const long=sha256Detailed('a'.repeat(65));assert.equal(long.trace.events.filter(e=>e.phase==='初始化寄存器').length,2);
});
test('SHA comparison reads only the corresponding real grid, including equal messages and target switch',async()=>{
 for(const [text,comparison,target,expected] of [['abc','abd','primary',122],['中文','中文','primary',0],['abc','abd','comparison',122]] as const){
  const run=await sha256Teaching({traceTarget:target},{text,comparison},42),trace=run.trace!,event=trace.events.at(-1)!,scene=sceneForTraceEvent(run,event),d=projectSha(trace,event,scene)!;
  assert.equal(d.mode,'compare');assert.equal(d.different,expected);assert.equal(d.comparisonCells.length,256);assert.equal(projectSha(trace,event)!.different,null);
  assert.deepEqual(projectSha(trace,trace.events[0])!.bytes,Array.from(new TextEncoder().encode(target==='comparison'?comparison:text)));
 }
});
test('SHA all events render without fabricated placeholders and leave traces unchanged',async()=>{
 for(const text of ['abc','','中文','a'.repeat(65)]){
  const run=await sha256Teaching({}, {text,comparison:'abd'},42),trace=run.trace!,before=teachingJSON(trace);
  for(const event of trace.events){assert(canShowSha(trace,event));const html=renderToStaticMarkup(createElement(ShaPrinciples,{trace,event,scene:sceneForTraceEvent(run,event)}));assert(html.includes(`data-sha-event="${event.id}"`));assert(!/NaN|undefined|未记录/.test(html),`${text} event ${event.id}`);}
  assert.equal(teachingJSON(trace),before);
 }
 const trace={...abc.trace,algorithmId:'bfs'};assert.equal(projectSha(trace,trace.events[0]),null);assert.equal(renderToStaticMarkup(createElement(ShaPrinciples,{trace,event:trace.events[0]})),'');
});
