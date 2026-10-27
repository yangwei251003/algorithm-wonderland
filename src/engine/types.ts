export type Params = Record<string, number | string>;
export interface VisualNode { id?: string; x: number; y: number; label?: string; color?: string; r?: number; value?: number; hollow?: boolean; }
export interface VisualEdge { from: string; to: string; label?: string; color?: string; width?: number; directed?: boolean; }
export interface Series { name: string; color?: string; points: {x:number;y:number}[]; }
export interface Scene {
  kind: 'bars'|'grid'|'graph'|'scatter'|'lines'|'matrix'|'text'|'image'|'schedule'|'world'|'beliefs';
  title?: string; note?: string; yUp?: boolean;showNodeIds?:boolean;nodeIdOffset?:number;
  values?: number[]; labels?: string[]; colors?: string[]; active?: number[]; secondary?: number[];
  rows?: number; cols?: number; cells?: (number|string)[]; palette?: string[]; cellLabels?: string[];
  nodes?: VisualNode[]; edges?: VisualEdge[]; paths?: {points:{x:number;y:number}[];color?:string;dashed?:boolean}[];
  series?: Series[]; matrix?: number[][]; matrixLabels?: string[][]; rowLabels?: string[]; columnLabels?: string[];
  text?: string[]; tokens?: {text:string;color?:string;sub?:string}[];
  pixels?: number[]; originalPixels?: number[]; originalLabel?: string;
  tasks?: {label:string;start:number;duration:number;row:number;color?:string}[];
  polygons?: {points:{x:number;y:number}[];color:string}[];
  beliefs?: {label:string;mean:number;variance:number;color:string}[];mixWeight?:number;
}
export interface Frame { scene: Scene; secondaryScene?: Scene; caption: string; metrics?: Record<string,number|string>; eventId?:string; }
export interface RunResult { frames: Frame[]; summary: string; metrics: Record<string,number|string>; trace?:import('./teaching').ExecutionTrace; }
export interface LabInput { walls?: number[]; points?: VisualNode[]; values?: number[]; text?: string; [key:string]: unknown; }
export type Runner = (input:LabInput,parameters:Params,seed:number)=>RunResult|Promise<RunResult>;
export interface Control {key:string;label:string;type:'range'|'select'|'text';defaultValue:number|string;min?:number;max?:number;step?:number;options?:{label:string;value:number|string}[];help?:string;}
export interface Preset {name:string;description:string;params:Params;input?:LabInput;}
export interface AlgorithmDefinition {
 id:string;category:number;name:string;subtitle:string;description:string;kind:'算法'|'统计方法'|'控制方法'|'模型'|'数据结构与操作';
 difficulty:number;novelty:number;creativity:number;prevalence:number|null;prevalenceNote:string;
 tags:string[];applications:string[];competition:string;limitation:string;assumptions:string;steps:string[];
 sources:{title:string;url:string}[];controls:Control[];presets:Preset[];
 question:{prompt:string;options:string[];correct:number;explanation:string};
 interaction?:'grid-walls'|'scatter-points'|'values';
}
