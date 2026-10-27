import type {LabInput,Params,Scene} from './types';

export type TeachingValue = string | number | boolean | null | TeachingValue[] | {[key:string]:TeachingValue};
export interface Calculation {formula:string;values:Record<string,string|number>;result:string|number;}
export interface Candidate {target:string;status:'chosen'|'deferred'|'rejected';reason:string;values?:Record<string,string|number>;}
export interface StateChange {target:string;before:TeachingValue;after:TeachingValue;}
export interface TraceEvent {
 id:string;parentId?:string;phase:string;ruleId:string;action:string;explanation:string;
 focus?:string[];calculation?:Calculation;candidates?:Candidate[];changes:StateChange[];
 frameIndex:number;scene?:Scene;
}
export interface ExecutionTrace {
 version:1;algorithmId:string;seed:number;initialState:Record<string,TeachingValue>;
 events:TraceEvent[];finalState:Record<string,TeachingValue>;complete:boolean;coverageNote?:string;
 checkpoints?:{through:number;state:Record<string,TeachingValue>}[];
}
export interface LessonRule {id:string;title:string;statement:string;formula?:string;sourceIds:string[];}
export interface Analogy {title:string;story:string;mappings:{everyday:string;algorithm:string;ruleIds:string[]}[];limit:string;}
export interface TeachingQuestion {kind:'next'|'alternative'|'change';prompt:string;options:string[];correct:number;explanation:string;}
export interface ResearchReference {id:string;title:string;url:string;author:string;section:string;observedDesign:string;checkedAt:string;verification:'read'|'interacted'|'watched';role:'visual'|'definition';limitations?:string;}
export interface LessonDefinition {
 algorithmId:string;version:number;variant:string;prerequisites:string[];rules:LessonRule[];
 analogy:Analogy;teachingCase:{input:LabInput;params:Params;seed:number};
 chapters:{id:string;title:string;ruleIds:string[]}[];questions:TeachingQuestion[];
 misconception:string;references:ResearchReference[];
}
export interface MediaManifest {
 algorithmId:string;lessonVersion:number;traceHash:string;
 comics:{role:'analogy'|'rules'|'summary';src:string;alt:string;preview?:string}[];
 video?:{src:string;poster:string;subtitles:string;transcript:string;duration:number;reviewStatus?:'preview'|'reviewed';chapters:{title:string;start:number;eventId?:string;teachingCase?:LessonDefinition['teachingCase'];caseTraceHash?:string;caseFile?:string}[]};
 reading?:{transcript:string};
 interactive?:{compositionId:string};download?:string;
}

/** Teaching state is an acyclic tree of numbers, strings, arrays and plain records.
 * Copy those directly; structuredClone's general serialization dominates large
 * concentration grids and per-sample training traces. Each snapshot still owns
 * its arrays, and NaN, infinities and signed zero stay numerical values. */
function copy<T>(value:T):T{
 if(value===null||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(item=>copy(item)) as T;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)])) as T;
}
/** Keep non-finite numerical states distinct when comparing or exporting traces. */
export function teachingJSON(value:unknown,space?:number):string{
 return JSON.stringify(value,(_key,item)=>typeof item==='number'&&!Number.isFinite(item)?{$number:String(item)}:item,space);
}
/** Compare immutable teaching values without serializing large unchanged arrays. */
function sameValue(a:TeachingValue,b:TeachingValue):boolean {
 if(a===b||typeof a==='number'&&typeof b==='number'&&Number.isNaN(a)&&Number.isNaN(b))return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameValue(v,b[i]));
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameValue(a[key],b[key]));
}
export class TraceRecorder {
 private state:Record<string,TeachingValue>;
 readonly trace:ExecutionTrace;
 constructor(algorithmId:string,seed:number,initialState:Record<string,TeachingValue>={}) {
  this.state=copy(initialState);
  this.trace={version:1,algorithmId,seed,initialState:copy(initialState),events:[],finalState:copy(initialState),complete:true};
 }
 add(event:Omit<TraceEvent,'id'|'changes'> & {changes?:StateChange[]},values:Record<string,TeachingValue>={}) {
  const changes=event.changes??Object.entries(values).filter(([key,value])=>!sameValue(this.state[key]??null,value)).map(([target,after])=>({target,before:copy(this.state[target]??null),after:copy(after)}));
  for(const change of changes){this.state[change.target]=copy(change.after);this.trace.finalState[change.target]=copy(change.after);}
  const item:TraceEvent={...event,id:String(this.trace.events.length),changes};
  this.trace.events.push(item);
  if(this.trace.events.length%256===0)(this.trace.checkpoints??=[]).push({through:this.trace.events.length-1,state:copy(this.state)});
  return item.id;
 }
 partial(reason:string){this.trace.complete=false;this.trace.coverageNote=reason;return this;}
}
export function replayTrace(trace:ExecutionTrace,through=trace.events.length-1) {
 const state=copy(trace.initialState);
 for(const event of trace.events.slice(0,through+1))for(const change of event.changes){
  if(teachingJSON(state[change.target]??null)!==teachingJSON(change.before))throw new Error('计算记录状态不一致：'+event.id+'/'+change.target);
  state[change.target]=copy(change.after);
 }
 return state;
}
/** Fast display lookup. Full verification must still use replayTrace(). */
export function stateAtTrace(trace:ExecutionTrace,through:number):Record<string,TeachingValue>{
 let checkpoint:NonNullable<ExecutionTrace['checkpoints']>[number]|undefined;
 for(let i=(trace.checkpoints?.length??0)-1;i>=0;i--){const c=trace.checkpoints![i];if(c.through<=through){checkpoint=c;break;}}
 if(!checkpoint)return replayTrace(trace,through);
 const state=copy(checkpoint.state);
 for(const event of trace.events.slice(checkpoint.through+1,through+1))for(const change of event.changes){
  if(teachingJSON(state[change.target]??null)!==teachingJSON(change.before))throw new Error('检查点后的计算状态不一致');
  state[change.target]=copy(change.after);
 }
 return state;
}
export const coreInteractiveIds=['binary-search','astar','knapsack','ant-colony','exponential-smoothing','kmeans','collaborative','hamming','median-filter','pid','topsis','boids','bfs','dijkstra','quick-sort','neural-network'];
