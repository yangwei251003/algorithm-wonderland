import test from 'node:test';
import assert from 'node:assert/strict';
import {runners} from '../src/algorithms/world';
import {lessons} from '../src/content/lessons/world';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sceneForTraceEvent} from '../src/engine/traceScene';
import {RoboticsPrinciples,canShowRobotics,projectRobotics,type ParticleProjection,type QProjection} from '../src/components/RoboticsPrinciples';
async function example(id:string){const c=lessons.find(l=>l.algorithmId===id)!.teachingCase;return (await runners[id](c.input,c.params,c.seed)).trace!;}
test('particle presentation reads recorded movement, posterior weights and CDF ancestry',async()=>{
 const trace=await example('particle-filter'),before=JSON.stringify(trace);
 const predict=projectRobotics(trace,trace.events[0]) as ParticleProjection;
 assert.equal(predict.oldParticles[0],60.11037519201636);assert.equal(predict.particles[0],60.435003032876125);
 const weighted=projectRobotics(trace,trace.events[1]) as ParticleProjection;
 assert.equal(weighted.measurement,22.72052571985787);assert.equal(weighted.bestIndex,106);assert(weighted.weights[0]<1e-12);
 const sample=projectRobotics(trace,trace.events[2]) as ParticleProjection;
 assert.equal(sample.ancestors[0],4);assert.equal(sample.pointers[0],sample.offset);assert.equal(sample.particles[0],17.198957530084115);
 for(let k=0;k<sample.pointers.length;k++){const ancestor=sample.ancestors[k];assert(sample.cdf[ancestor]>=sample.pointers[k]);if(ancestor)assert(sample.cdf[ancestor-1]<sample.pointers[k]);}
 assert.equal(JSON.stringify(trace),before);assert.equal(projectRobotics(trace,trace.events[3]),null);
});
test('Q presentation preserves actual cells, selected action and only the changed Q entry',async()=>{
 const trace=await example('qlearning'),first=projectRobotics(trace,trace.events[1]) as QProjection;
 assert.equal(first.from,0);assert.equal(first.to,0);assert.equal(first.action,'上');assert.deepEqual(first.oldQ,[0,0,0,0]);assert.deepEqual(first.newQ,[-.3,0,0,0]);assert.equal(first.target,-1);
 const terminal=projectRobotics(trace,trace.events[137]) as QProjection;
 assert.equal(terminal.from,39);assert.equal(terminal.to,47);assert.equal(terminal.target,20);assert.equal(terminal.newValue,6);assert.equal(terminal.epsilon,.25);
 const frozen=projectRobotics(trace,trace.events[1169]) as QProjection;
 assert.equal(frozen.action,'下');assert.equal(frozen.to,8);assert.deepEqual(frozen.newQ,[]);assert.equal(canShowRobotics(trace,trace.events[0]),false);
});
test('RRT rejection projection keeps the tree unchanged and exposes signed recorded clearance',async()=>{
 const trace=await example('rrt'),event=trace.events[28],p=projectRobotics(trace,event)!;
 assert.equal(p.state.accepted,false);assert.deepEqual(p.state.nodes,p.before('nodes'));
 assert.equal((p.state.clearances as number[])[1],-.11988975395807344);
 const connected=projectRobotics(trace,trace.events[84])!;assert.equal((connected.state.nodes as number[][]).length,25);
 assert.equal((connected.state.found as number),24);
});
test('force and pursuit diagrams use recorded vectors and actual look-ahead distance',async()=>{
 const potential=await example('potential-field'),p=projectRobotics(potential,potential.events[4])!;
 assert.equal((p.state.repulsion as number[][])[0][2],17.297618943783355);assert.equal((p.state.force as number[])[0],4.943508924466184);
 const pursuit=await example('pure-pursuit'),target=projectRobotics(pursuit,pursuit.events[0])!,steer=projectRobotics(pursuit,pursuit.events[1])!,moved=projectRobotics(pursuit,pursuit.events[2])!;
 assert.deepEqual(target.state.aim,[17,66.34918616050267]);assert.equal(pursuit.events[0].calculation?.result,13.576161640932188);
 assert.equal(steer.state.delta,.26890909835023946);assert.deepEqual(moved.before('position'),[5,60]);assert.deepEqual(moved.state.position,[5.399848116497093,60.011021965964694]);
});
test('all authored robotics detail events render semantic figures without invalid numeric SVG attributes',async()=>{
 let count=0;
 for(const id of ['particle-filter','rrt','potential-field','pure-pursuit','qlearning']){
  const c=lessons.find(l=>l.algorithmId===id)!.teachingCase,result=await runners[id](c.input,c.params,c.seed),trace=result.trace!;
  for(const event of trace.events.filter(e=>canShowRobotics(trace,e))){
   const html=renderToStaticMarkup(createElement(RoboticsPrinciples,{trace,event,scene:sceneForTraceEvent(result,event)}));
   assert(html.includes('aria-label="本步原理图"'),id+'/'+event.id);assert(html.includes('role="img"'));
   assert(!/(?:cx|cy|x1|x2|y1|y2|width|height)="(?:NaN|Infinity|-Infinity)"/.test(html),id+'/'+event.id);count++;
  }
 }
 assert.equal(count,24);
});
