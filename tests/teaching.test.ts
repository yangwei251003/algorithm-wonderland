import test from 'node:test';
import assert from 'node:assert/strict';
import {TraceRecorder,replayTrace,stateAtTrace,teachingJSON} from '../src/engine/teaching';
test('真实状态差异可重放，前一事件不会被后续数组变化改写',()=>{
 const source=[1,2],recorder=new TraceRecorder('test',42,{queue:source});
 source.push(3);
 recorder.add({phase:'检查',ruleId:'fifo',action:'出队',explanation:'先加入的先取出',frameIndex:0},{queue:[2]});
 recorder.add({phase:'检查',ruleId:'fifo',action:'入队',explanation:'新发现的放队尾',frameIndex:1},{queue:[2,4]});
 assert.deepEqual(recorder.trace.initialState,{queue:[1,2]});
 assert.deepEqual(replayTrace(recorder.trace,0),{queue:[2]});
 assert.deepEqual(replayTrace(recorder.trace),recorder.trace.finalState);
});
test('非有限数不会在状态差异或导出中被当作同一个null',()=>{
 const r=new TraceRecorder('test',42,{x:Infinity});
 r.add({phase:'检查',ruleId:'number',action:'变化',explanation:'明确保留数值类型',frameIndex:0},{x:NaN});
 assert.equal(r.trace.events[0].changes.length,1);
 assert(Number.isNaN(replayTrace(r.trace).x));
 assert.match(teachingJSON(r.trace),/\$number/);
});
test('嵌套快照保持数值类型且不共享可变数组',()=>{
 const input={grid:[[NaN,Infinity,-Infinity,-0],[1,2,3,4]],metadata:{title:'中文',flags:[true,false]}};
 const expected=structuredClone(input),r=new TraceRecorder('test',9,input);
 input.grid[1][0]=99;input.metadata.flags[0]=false;
 assert.deepEqual(r.trace.initialState,expected);
 const update=[[5,6],[7,8]];
 r.add({phase:'更新',ruleId:'copy',action:'替换网格',explanation:'保留旧状态',frameIndex:0},{grid:update});
 update[0][0]=100;
 assert.deepEqual(r.trace.events[0].changes[0].after,[[5,6],[7,8]]);
 (r.trace.finalState.grid as number[][])[0][0]=200;
 assert.deepEqual(r.trace.events[0].changes[0].after,[[5,6],[7,8]]);
 assert.deepEqual(replayTrace(r.trace).grid,[[5,6],[7,8]]);
 assert(Object.is((r.trace.initialState.grid as number[][])[0][3],-0));
});
test('长记录检查点与完整重放一致，而且完整审计不会跳过前段',()=>{
 const r=new TraceRecorder('test',42,{x:0});
 for(let i=0;i<600;i++)r.add({phase:'累加',ruleId:'add',action:'加1',explanation:'在旧值上加1',frameIndex:0},{x:i+1});
 assert.equal(r.trace.checkpoints!.length,2);
 for(const i of [0,254,255,256,511,599])assert.deepEqual(stateAtTrace(r.trace,i),replayTrace(r.trace,i));
 r.trace.events[0].changes[0].before=77;assert.throws(()=>replayTrace(r.trace));
});
test('篡改中间计算状态必须被发现',()=>{
 const recorder=new TraceRecorder('test',42,{x:2});
 recorder.add({phase:'求和',ruleId:'sum',action:'加3',explanation:'2+3=5',frameIndex:0},{x:5});
 recorder.trace.events[0].changes[0].before=3;
 assert.throws(()=>replayTrace(recorder.trace),/状态不一致/);
});
