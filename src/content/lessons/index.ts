import type {LessonDefinition,MediaManifest} from '../../engine/teaching';
import {lessons as intelligence} from './intelligence';
import {lessons as core} from './core';
import {lessons as world} from './world';
import {referencesById} from './references.generated';
export const lessons:LessonDefinition[]=[...core,...intelligence,...world].map(lesson=>{
 const references=referencesById[lesson.algorithmId]??lesson.references,definitions=references.filter(r=>r.role==='definition');
 // Authoring shorthand resolves to the actual, individually checked reference ID.
 const rules=lesson.rules.map(rule=>({...rule,sourceIds:rule.sourceIds.map(id=>{
  const prefix=lesson.algorithmId+'-d';
  if(!references.some(r=>r.id===id)&&id.startsWith(prefix)){const ordinal=Number(id.slice(prefix.length));if(Number.isInteger(ordinal)&&ordinal>0&&definitions[ordinal-1])return definitions[ordinal-1].id;}
  return id;
 })}));
 return {...lesson,rules,references};
});
export const lessonById:Record<string,LessonDefinition>=Object.assign(Object.create(null),Object.fromEntries(lessons.map(lesson=>[lesson.algorithmId,lesson])));
export const mediaById:Record<string,MediaManifest>=Object.create(null);
