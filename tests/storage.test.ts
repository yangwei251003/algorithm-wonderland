import test from 'node:test';
import assert from 'node:assert/strict';
import {validateImport,learning} from '../src/engine/storage';
import {normalizeInput,normalizeParams} from '../src/engine/validation';
import {byId} from '../src/content/catalog';
const blank=()=>({schemaVersion:1,favorites:[],progress:{},experiments:{},lastId:null,reducedMotion:false});
test('backup schema rejects malformed structures and unknown exhibit IDs',()=>{
 for(const v of [null,{}, {...blank(),schemaVersion:3},{...blank(),progress:[]},{...blank(),experiments:[]},{...blank(),favorites:['constructor']},{...blank(),favorites:['invented-item']}])assert.throws(()=>validateImport(v));
 const good=validateImport({...blank(),favorites:['astar','astar'],progress:{astar:'understood'}});assert.deepEqual(good.favorites,['astar']);assert.equal(good.progress.astar,'understood');
 assert.throws(()=>validateImport({...blank(),experiments:{astar:{params:[],input:{},seed:42,updatedAt:'today'}}}));
});
test('v1 records migrate without losing favorites and v2 checks viewing progress',()=>{
 const old=validateImport({...blank(),favorites:['kmeans'],progress:{kmeans:'understood'}});assert.equal(old.schemaVersion,2);assert.deepEqual(old.favorites,['kmeans']);assert.deepEqual(old.mediaProgress,{});
 const current=validateImport({...blank(),schemaVersion:2,mediaProgress:{kmeans:{seconds:35,complete:false,chapter:'比较距离'}}});assert.equal(current.mediaProgress?.kmeans.seconds,35);
 for(const progress of [{kmeans:{seconds:-1,complete:false}},{constructor:{seconds:0,complete:false}},{kmeans:{seconds:3,complete:'yes'}}])assert.throws(()=>validateImport({...blank(),schemaVersion:2,mediaProgress:progress}));
});
test('rewatching a completed film keeps completion while preserving the new resume position',()=>{
 learning.watch('bfs',140,true);learning.chapter('bfs','队列与层数');learning.watch('bfs',35,false);
 const saved=validateImport(JSON.parse(learning.export()));
 assert.deepEqual(saved.mediaProgress?.bfs,{seconds:35,complete:true,chapter:'队列与层数'});
});
test('imported controls are bounded without erasing the counting-sort failure example',()=>{
 const p=normalizeParams(byId['neural-network'],{hidden:1e12,noise:-9,rate:Infinity,shape:'invalid'});assert.equal(p.hidden,10);assert.equal(p.noise,0);assert.equal(p.shape,'clusters');assert.equal(p.rate,.6);
 const input=normalizeInput({values:[1,100000],walls:[-1,1,1,900],points:[{x:200,y:-5},{x:NaN,y:4}]});assert.deepEqual(input.values,[1,100000]);assert.deepEqual(input.walls,[1]);assert.equal(input.points?.length,1);assert.equal(input.points?.[0].x,100);
});
