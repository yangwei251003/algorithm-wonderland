import test from 'node:test';
import assert from 'node:assert/strict';
import {algorithms,categories,firstJourney,flagshipIds} from '../src/content/catalog';
import {defaults} from '../src/engine/utils';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
import {runners as core} from '../src/algorithms/core';
import {runners as intelligence} from '../src/algorithms/intelligence';
import {runners as world} from '../src/algorithms/world';
import type {Scene} from '../src/engine/types';
const runners={...core,...intelligence,...world};
test('84 entries across 12 complete categories, with real runners and complete learning content',()=>{
 assert.equal(algorithms.length,84);assert.equal(new Set(algorithms.map(a=>a.id)).size,84);assert.equal(Object.keys(runners).length,84);
 for(const cat of categories)assert.equal(algorithms.filter(a=>a.category===cat.id).length,7);
 for(const a of algorithms){assert.ok(runners[a.id],a.id);for(const key of ['name','subtitle','description','competition','limitation','assumptions','prevalenceNote'] as const)assert.ok(a[key].length>2,a.id+' '+key);assert.ok(a.controls.length>=2&&a.controls.length<=4,a.id+' controls');assert.ok(a.presets.length>=2,a.id+' presets');assert.ok(a.steps.length>=2,a.id+' steps');assert.ok(a.applications.length>=2,a.id+' applications');assert.ok(a.sources.every(s=>/^https:\/\//.test(s.url)),a.id+' sources');assert.ok(a.question.correct>=0&&a.question.correct<a.question.options.length,a.id+' question');for(const score of [a.difficulty,a.novelty,a.creativity,a.prevalence??1])assert.ok(score>=1&&score<=5,a.id+' rating');}
 for(const id of [...firstJourney,...flagshipIds])assert.ok(runners[id],id);
});
function inspectScene(s:Scene,id:string){
 assert.ok(s&&s.kind,id+' scene');
 if(s.cells){assert.ok(s.rows&&s.cols,id+' cells dimensions');assert.equal(s.cells.length,s.rows!*s.cols!,id+' cell count');}
 if(s.pixels){assert.ok(s.rows&&s.cols,id+' image dimensions');assert.equal(s.pixels.length,s.rows!*s.cols!*4,id+' RGBA size');}
 for(const node of s.nodes??[])assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y),id+' finite point');
 for(const line of s.series??[])for(const point of line.points)assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y),id+' finite series');
 if(s.edges){const ids=new Set(s.nodes?.map((n,i)=>n.id??String(i)));for(const edge of s.edges)assert.ok(ids.has(edge.from)&&ids.has(edge.to),id+' edge endpoints');}
}
for(const a of algorithms)test(a.id+' defaults + success/boundary presets produce finite interpretable scenes',async()=>{
 const all=[{params:defaults(a),input:{}},...a.presets.map(p=>({params:{...defaults(a),...p.params},input:p.input??{}}))];
 for(const p of all){const started=performance.now();const r=await runners[a.id](normalizeInput(p.input),normalizeParams(a,p.params),42);assert.ok(r.frames.length>0&&r.frames.length<=5000,a.id+' frame count');assert.ok(r.summary.length>2);for(const f of r.frames){assert.ok(f.caption.length>0);inspectScene(f.scene,a.id);if(f.secondaryScene)inspectScene(f.secondaryScene,a.id);for(const value of Object.values(f.metrics??{}))if(typeof value==='number')assert.ok(Number.isFinite(value),a.id+' frame metric');}for(const value of Object.values(r.metrics))if(typeof value==='number')assert.ok(Number.isFinite(value),a.id+' result metric');assert.ok(performance.now()-started<10000,a.id+' bounded teaching input');}
});
