import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {runners} from '../src/algorithms/intelligence';
import {replayTrace,teachingJSON} from '../src/engine/teaching';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
import {byId} from '../src/content/catalog';

const id='linear-regression';
const baseline=JSON.parse(await readFile(`media/exports/${id}.json`,'utf8'));
const input={points:[{x:10,y:20},{x:20,y:30},{x:30,y:40},{x:40,y:90}]};
const {params,seed}=baseline.lesson.teachingCase;
const run=await runners[id](input,params,seed);
const normalized=await runners[id](normalizeInput(input),normalizeParams(byId[id],params),seed);
assert.equal(teachingJSON(run.trace),teachingJSON(normalized.trace));
assert.ok(run.trace?.complete);
assert.deepEqual(replayTrace(run.trace!),run.trace!.finalState);
assert.equal(run.trace!.finalState.slope,2.2);
assert.ok(Math.abs(Number(run.trace!.finalState.intercept)+10)<1e-10);
assert.ok(Math.abs(Number(run.trace!.finalState.sse)-480)<1e-8);
assert.ok(Math.abs(Number(run.trace!.finalState.rmse)-Math.sqrt(120))<1e-8);
const traceHash=createHash('sha256').update(teachingJSON(run.trace)).digest('hex');
await writeFile('media/exports/review-counterexample-linear-regression.json',teachingJSON({
 schemaVersion:1,algorithm:{...baseline.algorithm,subtitle:'最后一个观测值50改为90，重新拟合'},
 lesson:{...baseline.lesson,teachingCase:{input,params,seed}},run,traceHash,
},2));
console.log({id,traceHash,events:run.trace!.events.length});
