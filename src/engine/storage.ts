import {useSyncExternalStore} from 'react';
import type {LabInput,Params} from './types';
import {byId} from '../content/catalog';
export interface SavedExperiment {params:Params;input:LabInput;seed:number;updatedAt:string;}
export interface LearningState {schemaVersion:1|2;favorites:string[];progress:Record<string,'visited'|'understood'|'review'>;experiments:Record<string,SavedExperiment>;lastId:string|null;reducedMotion:boolean;mediaProgress?:Record<string,{seconds:number;complete:boolean;chapter?:string}>;}
const key='algorithm-wonderland:v1';
const empty=():LearningState=>({schemaVersion:2,favorites:[],progress:{},experiments:{},lastId:null,reducedMotion:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,mediaProgress:{}});
const listeners=new Set<()=>void>();
export function validateImport(value:unknown):LearningState{
 if(!value||typeof value!=='object')throw new Error('备份文件格式不正确。');
 const v=value as Partial<LearningState>;
 if(![1,2].includes(v.schemaVersion??0)||!Array.isArray(v.favorites)||!v.progress||typeof v.progress!=='object'||Array.isArray(v.progress)||!v.experiments||typeof v.experiments!=='object'||Array.isArray(v.experiments))throw new Error('请选择算法奇境导出的第1或第2版学习备份。');
 const validId=(id:string)=>/^[a-z0-9-]{1,60}$/.test(id)&&Object.hasOwn(byId,id);
 if(v.favorites.some(id=>typeof id!=='string'||!validId(id)))throw new Error('收藏记录格式不正确。');
 const progress:LearningState['progress']={};const experiments:LearningState['experiments']={};
 for(const [id,status] of Object.entries(v.progress)){if(!validId(id)||!['visited','understood','review'].includes(status))throw new Error('学习进度格式不正确。');progress[id]=status;}
 for(const [id,item] of Object.entries(v.experiments)){
  if(!validId(id)||!item||typeof item!=='object'||!Number.isFinite(item.seed)||!item.params||typeof item.params!=='object'||Array.isArray(item.params)||!item.input||typeof item.input!=='object'||Array.isArray(item.input)||typeof item.updatedAt!=='string')throw new Error('实验记录格式不正确。');
  if(Object.values(item.params).some(x=>!['number','string'].includes(typeof x)||(typeof x==='number'&&!Number.isFinite(x))))throw new Error('实验参数格式不正确。');
  experiments[id]=item;
 }
 const mediaProgress:NonNullable<LearningState['mediaProgress']>={};
 if(v.mediaProgress!==undefined){if(!v.mediaProgress||typeof v.mediaProgress!=='object'||Array.isArray(v.mediaProgress))throw new Error('观看记录格式不正确。');for(const [id,entry] of Object.entries(v.mediaProgress)){if(!validId(id)||!entry||typeof entry!=='object'||!Number.isFinite(entry.seconds)||entry.seconds<0||entry.seconds>86400||typeof entry.complete!=='boolean'||(entry.chapter!==undefined&&(typeof entry.chapter!=='string'||entry.chapter.length>200)))throw new Error('观看记录格式不正确。');mediaProgress[id]={seconds:entry.seconds,complete:entry.complete,...(entry.chapter?{chapter:entry.chapter}:{})};}}
 return{schemaVersion:2,favorites:[...new Set(v.favorites)],progress,experiments,lastId:typeof v.lastId==='string'&&validId(v.lastId)?v.lastId:null,reducedMotion:!!v.reducedMotion,mediaProgress};
}
let storageWarning='';
let state:LearningState=(()=>{try{const raw=localStorage.getItem(key);return raw?validateImport(JSON.parse(raw)):empty();}catch{storageWarning='浏览器未能读取学习记录；你仍可体验并导出新的记录。';return empty();}})();
export function getStorageWarning(){return storageWarning;}
function update(change:(old:LearningState)=>LearningState){state=change(state);try{localStorage.setItem(key,JSON.stringify(state));storageWarning='';}catch{storageWarning='浏览器无法保存记录，请使用导出备份。';}listeners.forEach(f=>f());}
export const learning={
 favorite:(id:string)=>update(s=>({...s,favorites:s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id]})),
 visit:(id:string)=>update(s=>({...s,lastId:id,progress:{...s.progress,[id]:s.progress[id]??'visited'}})),
 mark:(id:string,status:'visited'|'understood'|'review')=>update(s=>({...s,progress:{...s.progress,[id]:status}})),
 save:(id:string,experiment:Omit<SavedExperiment,'updatedAt'>)=>update(s=>({...s,experiments:{...s.experiments,[id]:{...experiment,updatedAt:new Date().toISOString()}}})),
 reduce:(value:boolean)=>update(s=>({...s,reducedMotion:value})),
 watch:(id:string,seconds:number,complete:boolean)=>update(s=>({...s,schemaVersion:2,mediaProgress:{...s.mediaProgress,[id]:{...s.mediaProgress?.[id],seconds:Math.max(0,seconds),complete:complete||!!s.mediaProgress?.[id]?.complete}}})),
 chapter:(id:string,chapter:string)=>update(s=>({...s,schemaVersion:2,mediaProgress:{...s.mediaProgress,[id]:{seconds:0,complete:false,...s.mediaProgress?.[id],chapter}}})),
 import:(raw:string)=>{if(raw.length>2_000_000)throw new Error('备份文件过大，请选择本站导出的学习记录。');const incoming=validateImport(JSON.parse(raw));update(s=>({...s,favorites:[...new Set([...s.favorites,...incoming.favorites])],progress:{...incoming.progress,...s.progress},experiments:{...incoming.experiments,...s.experiments},mediaProgress:{...incoming.mediaProgress,...s.mediaProgress},schemaVersion:2,lastId:s.lastId??incoming.lastId}));},
 export:()=>JSON.stringify(state,null,2),
};
export const useLearning=()=>useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb);},()=>state);
