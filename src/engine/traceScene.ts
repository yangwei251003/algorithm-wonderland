import type {RunResult,Scene} from './types';
import type {ExecutionTrace,TraceEvent} from './teaching';

const cache=new WeakMap<ExecutionTrace,Map<string,Scene>>();
/** A metadata-only event continues the latest recorded picture for its frame.
 * Returning to the base frame would visually undo earlier, real state changes. */
export function sceneForTraceEvent(result:RunResult,event:TraceEvent):Scene{
 const trace=result.trace;
 if(!trace)return event.scene??result.frames[event.frameIndex].scene;
 let scenes=cache.get(trace);
 if(!scenes){
  scenes=new Map();let previousFrame=-1,current:Scene|undefined;
  for(const item of trace.events){
   if(item.scene)current=item.scene;
   else if(item.frameIndex!==previousFrame||!current)current=result.frames[item.frameIndex].scene;
   scenes.set(item.id,current);previousFrame=item.frameIndex;
  }
  cache.set(trace,scenes);
 }
 return scenes.get(event.id)??event.scene??result.frames[event.frameIndex].scene;
}
