import type {Frame,Scene} from '../engine/types';
import {TraceRecorder,type TraceEvent,type TeachingValue} from '../engine/teaching';
export {TraceRecorder};
export const finite=(value:number):number|string=>Number.isFinite(value)?value:'∞';
export const numbers=(values:number[])=>values.map(finite);
export function record(rec:TraceRecorder,frames:Frame[],event:Omit<TraceEvent,'id'|'changes'|'frameIndex'>,state:Record<string,TeachingValue>={},scene?:Scene){
 if(!frames.length)throw new Error('必须先建立真实初始画面。');
 const id=rec.add({...event,frameIndex:frames.length-1,scene:scene?structuredClone(scene):event.scene},state);
 frames[frames.length-1].eventId??=id;return id;
}
