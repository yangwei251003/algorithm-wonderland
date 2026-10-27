import type {Frame,Scene,RunResult} from '../engine/types';
import {TraceRecorder,type TraceEvent,type TeachingValue} from '../engine/teaching';
import {result} from '../engine/utils';

/** A record is emitted at the actual rule branch, never reconstructed from finished captions. */
export class WorldRecord {
 readonly frames:Frame[]=[];
 readonly recorder:TraceRecorder;
 constructor(id:string,seed:number,state:Record<string,TeachingValue>={}){this.recorder=new TraceRecorder(id,seed,state);}
 add(event:Omit<TraceEvent,'id'|'changes'|'frameIndex'|'scene'>,scene:Scene,state:Record<string,TeachingValue>={},metrics:Record<string,string|number>={}){
  const eventId=this.recorder.add({...event,frameIndex:this.frames.length},state);
  this.frames.push({scene:structuredClone(scene),caption:event.explanation,metrics,eventId});
 }
 finish(summary:string,metrics:Record<string,string|number>,coverageNote?:string):RunResult{
  if(coverageNote)this.recorder.trace.coverageNote=coverageNote;
  return {...result(this.frames,summary,metrics),trace:this.recorder.trace};
 }
}
