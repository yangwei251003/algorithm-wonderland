import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256Detailed,sha256Teaching} from '../src/algorithms/intelligence-sha256';
import {replayTrace} from '../src/engine/teaching';
for(const text of ['', 'abc', '算法奇境', '你好🌏', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(129), '算法'.repeat(100)]){
 test('SHA-256 标准摘要与逐步记录：'+(text.length<10?text:text.length+'字符'),()=>{
  const actual=sha256Detailed(text),expected=createHash('sha256').update(text).digest('hex');
  assert.equal(actual.digest,expected);
  assert.deepEqual(replayTrace(actual.trace),actual.trace.finalState);
  assert.equal(actual.trace.finalState.digest,expected);
  const blocks=Math.ceil((new TextEncoder().encode(text).length+9)/64);
  assert.equal(actual.trace.events.filter(e=>e.phase==='更新寄存器').length,blocks*64);
  assert.equal(actual.trace.events.filter(e=>e.phase==='块合并').length,blocks);
 });
}
test('SHA-256切换展开对象仍保持两份摘要及变化位数一致',async()=>{
 const p={text:'abc',comparison:'abd'},a=await sha256Teaching({},p,42),b=await sha256Teaching({traceTarget:'comparison'},p,42);
 assert.deepEqual(a.metrics,b.metrics);
 assert.equal(a.trace!.finalState.digest,a.metrics['摘要']);
 assert.equal(b.trace!.finalState.digest,b.metrics['比较摘要']);
 assert.deepEqual(replayTrace(b.trace!),b.trace!.finalState);
 assert.equal((await sha256Teaching({},{text:'abc',comparison:'abc'},42)).metrics['变化位数'],0);
});
