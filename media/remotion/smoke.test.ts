import test from 'node:test';
import assert from 'node:assert/strict';
import {runSmokeBfs} from './smoke';
test('actual BFS reacts to origin, goal and obstacles',()=>{
 const original=runSmokeBfs({origin:0,goal:24,walls:[7,12,17]});
 assert.equal(original.distance,8);
 assert.equal(runSmokeBfs({origin:5,goal:24,walls:[7,12,17]}).distance,7);
 assert.equal(runSmokeBfs({origin:0,goal:20,walls:[7,12,17]}).distance,4);
 assert.equal(runSmokeBfs({origin:0,goal:24,walls:[5,6,7,8,9]}).distance,-1);
 assert.equal(runSmokeBfs({origin:0,goal:0,walls:[]}).distance,0);
 assert.equal(original.path[0],0);assert.equal(original.path.at(-1),24);
});
test('snapshots are immutable, deterministic, and reconstruct a valid path',()=>{
 const input={origin:0,goal:24,walls:[7,12,17]};
 const a=runSmokeBfs(input),b=runSmokeBfs(input);
 assert.deepEqual(a,b);assert.deepEqual(a.events[0].queue,[0]);assert.deepEqual(a.events[0].reached,[0]);
 for(let i=1;i<a.path.length;i++){const u=a.path[i-1],v=a.path[i];assert.equal(Math.abs(u%5-v%5)+Math.abs(Math.floor(u/5)-Math.floor(v/5)),1);assert.ok(!input.walls.includes(v));}
});
