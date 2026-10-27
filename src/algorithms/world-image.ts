import type {Scene} from '../engine/types';
import {rng,clamp,gaussian} from '../engine/utils';
export const W=48,H=32;
export const rgba=(a:number[])=>a.flatMap(v=>{const c=Math.round(clamp(v,0,255));return [c,Math.round(c*.95),Math.round(c*.83),255];});
export const image=(a:number[],w=W,h=H,title='图像'):Scene=>({kind:'image',cols:w,rows:h,pixels:rgba(a),title});
export function picture(contrast=1){return Array.from({length:W*H},(_,i)=>{const x=i%W,y=Math.floor(i/W);let v=35+x*.45;if((x-25)**2+(y-15)**2<70)v=215;if(x>4&&x<13&&y>8&&y<26)v=140;return 128+(v-128)*contrast;});}
export function noiseImage(seed:number,amount:number,salt=false,contrast=1){const random=rng(seed),clean=picture(contrast);return {clean,noisy:clean.map(v=>salt?(random()<amount/100?(random()<.5?0:255):v):clamp(v+gaussian(random)*amount,0,255))};}
export function windowValues(a:number[],x:number,y:number,r:number){const vs:number[]=[];for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)vs.push(a[clamp(y+dy,0,H-1)*W+clamp(x+dx,0,W-1)]);return vs;}
export const mse=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length;

