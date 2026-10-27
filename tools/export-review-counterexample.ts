import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {runners} from '../src/algorithms/core';
import {replayTrace,teachingJSON} from '../src/engine/teaching';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
import {byId} from '../src/content/catalog';

// Dedicated audit counterexample. Keep the original lesson export immutable.
const id='linear-search';
const baseline=JSON.parse(await readFile(`media/exports/${id}.json`,'utf8'));
const lesson=baseline.lesson;
const input=lesson.teachingCase.input;
const params={...lesson.teachingCase.params,target:99};
const seed=lesson.teachingCase.seed;
const run=await runners[id](input,params,seed);
const browserRun=await runners[id](normalizeInput(input),normalizeParams(byId[id],params),seed);
assert.equal(teachingJSON(run.trace),teachingJSON(browserRun.trace));
assert.ok(run.trace?.complete);
assert.deepEqual(replayTrace(run.trace!),run.trace!.finalState);
const compared=run.trace!.events.filter(e=>e.phase==='compare');
assert.equal(compared.length,4);
assert.deepEqual(compared.map(e=>e.calculation?.values.value),[12,7,20,7]);
assert.ok(compared.every(e=>e.calculation?.values.target===99&&e.calculation.result==='不等'));
assert.ok(compared.every(e=>e.candidates?.every(c=>c.status==='rejected')));
const traceHash=createHash('sha256').update(teachingJSON(run.trace)).digest('hex');
const payload={schemaVersion:1,algorithm:{...baseline.algorithm,subtitle:'同一清单，目标99不存在'},lesson:{...lesson,teachingCase:{input,params,seed}},run,traceHash};
await writeFile(`media/exports/${id}-review-counterexample.json`,teachingJSON(payload,2));
console.log(JSON.stringify({id,events:run.trace!.events.length,metrics:run.metrics,traceHash,checks:'4 actual failed comparisons; full trace replay; browser normalization identical'}));
