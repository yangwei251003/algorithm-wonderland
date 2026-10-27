import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {runners} from '../src/algorithms/core';
import {replayTrace,teachingJSON} from '../src/engine/teaching';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
import {byId} from '../src/content/catalog';

const id='heap-sort';
const baseline=JSON.parse(await readFile(`media/exports/${id}.json`,'utf8'));
const input={...baseline.lesson.teachingCase.input,values:[9,2,8]};
const {params,seed}=baseline.lesson.teachingCase;
const run=await runners[id](input,params,seed);
const normalized=await runners[id](normalizeInput(input),normalizeParams(byId[id],params),seed);
assert.equal(teachingJSON(run.trace),teachingJSON(normalized.trace));
assert.ok(run.trace?.complete);
assert.deepEqual(replayTrace(run.trace!),run.trace!.finalState);
assert.deepEqual(run.trace!.initialState.array,[9,2,8]);
assert.deepEqual(run.trace!.finalState.array,[2,8,9]);
const built=run.trace!.events.find(e=>e.action==='该子树已满足大顶堆');
assert.ok(built);
assert.deepEqual(built.scene?.values,[9,2,8]);
const traceHash=createHash('sha256').update(teachingJSON(run.trace)).digest('hex');
await writeFile('media/exports/review-counterexample-heap-sort.json',teachingJSON({
 schemaVersion:1,algorithm:{...baseline.algorithm,subtitle:'有效大顶堆允许左孩子小于右孩子'},
 lesson:{...baseline.lesson,teachingCase:{input,params,seed}},run,traceHash,
},2));
console.log({id,traceHash,builtEvent:built.id,events:run.trace!.events.length});
