import type {Frame,Runner,Scene} from '../engine/types';
import {TraceRecorder} from '../engine/teaching';
import {result,round,str} from '../engine/utils';
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const INITIAL=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const rotr=(x:number,n:number)=>((x>>>n)|(x<<(32-n)))>>>0;
const hex=(x:number)=>'0x'+(x>>>0).toString(16).padStart(8,'0');
const bits=(x:number)=>Array.from({length:32},(_,i)=>(x>>>(31-i))&1);
export function sha256Detailed(text:string,seed=42,observe=true){
 const bytes=new TextEncoder().encode(text),length=Math.ceil((bytes.length+9)/64)*64,padded=new Uint8Array(length);padded.set(bytes);padded[bytes.length]=0x80;
 const data=new DataView(padded.buffer),bitLength=BigInt(bytes.length)*8n;data.setBigUint64(length-8,bitLength,false);
 const frames:Frame[]=[],recorder=new TraceRecorder('sha256',seed,{messageBytes:Array.from(bytes),chain:INITIAL.map(hex)});let H=[...INITIAL];
 const wordsScene=(words:number[],title:string):Scene=>({kind:'text',title,tokens:words.map((value,i)=>({text:String.fromCharCode(97+i)+' = '+hex(value),color:i<4?'#78edd0':'#f6c37b',sub:'32位无符号整数'}))});
 const emit=(e:Omit<Parameters<TraceRecorder['add']>[0],'frameIndex'>,values:Parameters<TraceRecorder['add']>[1],scene:Scene)=>{if(!observe)return;const id=recorder.add({...e,frameIndex:frames.length},values);frames.push({scene,caption:e.explanation,eventId:id});};
 emit({phase:'准备字节',ruleId:'sha256-bytes',action:'先把文本编码为UTF-8字节',explanation:'算法接收字节序列，不直接接收汉字。当前文本得到 '+bytes.length+' 个字节；一个汉字通常占多个UTF-8字节。',calculation:{formula:'原消息位数 = 字节数 × 8',values:{'字节数':bytes.length},result:Number(bitLength)}},{bitLength:Number(bitLength)},{kind:'text',title:'字符与字节不是一回事',text:['输入：'+(text||'（空文本）'),'字节数：'+bytes.length,'十六进制字节：'+Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join(' ')]});
 emit({phase:'补齐',ruleId:'sha256-padding',action:'追加1、若干0，以及原消息长度',explanation:'先追加一个1比特，再补0直到最后空出64比特写原长度。每块恰好512比特；长度占64比特，按高位在前写入。',calculation:{formula:'总长度 = 512的整数倍；末64位保存原消息位数',values:{'原位数':Number(bitLength),'填充后字节':length,'块数':length/64},result:length*8}},{paddedBytes:Array.from(padded)},{kind:'text',title:'补齐到完整512位块',text:['原消息 '+bytes.length+' 字节','追加 0x80：一个1比特和七个0比特','继续补 '+(length-bytes.length-9)+' 个0字节','末尾8字节保存原长度 '+bitLength.toString()+' 比特','共 '+length/64+' 块，每块64字节']});
 for(let block=0;block<length/64;block++){
  const W=Array<number>(64).fill(0);
  for(let t=0;t<16;t++){
   W[t]=data.getUint32(block*64+t*4,false);
   emit({phase:'消息调度',ruleId:'sha256-schedule',action:'第'+(block+1)+'块：读取W['+t+']',explanation:'四个相邻字节按高位在前组成一个32位字。前16个W直接来自当前512位消息块。',calculation:{formula:'W[t] = 4个连续字节组成的32位字',values:{t,'字节偏移':block*64+t*4},result:hex(W[t])}},{block:block+1,['W['+t+']']:hex(W[t])},{kind:'grid',title:'W['+t+'] = '+hex(W[t]),cols:32,rows:1,cells:bits(W[t]),palette:['#1b2b3a','#78edd0']});
  }
  for(let t=16;t<64;t++){
   const x=W[t-15],y=W[t-2],s0=(rotr(x,7)^rotr(x,18)^(x>>>3))>>>0,s1=(rotr(y,17)^rotr(y,19)^(y>>>10))>>>0;
   W[t]=(W[t-16]+s0+W[t-7]+s1)>>>0;
   emit({phase:'消息调度',ruleId:'sha256-schedule',action:'扩展W['+t+']',explanation:'对先前的字做循环右移、逻辑右移和异或，再与另外两个字相加。只保留低32位；这是固定规则，没有挑选候选路径。',calculation:{formula:'W[t] = W[t−16] + σ0(W[t−15]) + W[t−7] + σ1(W[t−2]) (mod 2³²)',values:{'W[t−16]':hex(W[t-16]),'ROTR7(x)':hex(rotr(x,7)),'ROTR18(x)':hex(rotr(x,18)),'x>>>3':hex(x>>>3),'σ0':hex(s0),'W[t−7]':hex(W[t-7]),'ROTR17(y)':hex(rotr(y,17)),'ROTR19(y)':hex(rotr(y,19)),'y>>>10':hex(y>>>10),'σ1':hex(s1)},result:hex(W[t])}},{['W['+t+']']:hex(W[t])},{kind:'grid',title:'从已有字扩展W['+t+']',cols:32,rows:4,cells:[...bits(W[t-16]),...bits(s0),...bits(W[t-7]),...bits(s1)],palette:['#1b2b3a','#78edd0'],note:'从上到下：W[t−16]、σ0、W[t−7]、σ1；四行相加只保留低32位。'});
  }
  let [a,b,c,d,e,f,g,h]=H;
  emit({phase:'初始化寄存器',ruleId:'sha256-registers',action:'把上一个块的状态装入a到h',explanation:block===0?'第一个块从标准规定的8个初值开始。之后的每一轮都更新这8个32位寄存器。':'后续块继承上一个块的链式状态，不能把每块单独算完后随意拼接。'},{registers:[a,b,c,d,e,f,g,h].map(hex)},wordsScene([a,b,c,d,e,f,g,h],'第'+(block+1)+'块 · 初始寄存器'));
  for(let t=0;t<64;t++){
   const r6=rotr(e,6),r11=rotr(e,11),r25=rotr(e,25),s1=(r6^r11^r25)>>>0,ch=((e&f)^((~e)&g))>>>0,T1=(h+s1+ch+K[t]+W[t])>>>0;
   emit({phase:'第'+(t+1)+'轮 · 计算T1',ruleId:'sha256-round',action:'由e、f、g、h和本轮消息算T1',explanation:'Σ1将e循环右移6、11、25位后异或。Ch按e的每一位选择f或g的对应位，再加入h、轮常数和W，最后保留低32位。',calculation:{formula:'T1 = h + Σ1(e) + Ch(e,f,g) + K[t] + W[t] (mod 2³²)',values:{h:hex(h),'ROTR6(e)':hex(r6),'ROTR11(e)':hex(r11),'ROTR25(e)':hex(r25),'Σ1(e)':hex(s1),'Ch':hex(ch),K:hex(K[t]),W:hex(W[t])},result:hex(T1)}},{round:t+1,T1:hex(T1)},wordsScene([a,b,c,d,e,f,g,h],'第'+(block+1)+'块 / 第'+(t+1)+'轮 · T1'));
   const r2=rotr(a,2),r13=rotr(a,13),r22=rotr(a,22),s0=(r2^r13^r22)>>>0,maj=((a&b)^(a&c)^(b&c))>>>0,T2=(s0+maj)>>>0;
   emit({phase:'第'+(t+1)+'轮 · 计算T2',ruleId:'sha256-round',action:'由a、b、c计算T2',explanation:'Σ0把a的三个循环右移结果异或。Maj对a、b、c每一位取多数值。两项相加保留低32位，得到T2。',calculation:{formula:'T2 = Σ0(a) + Maj(a,b,c) (mod 2³²)',values:{'ROTR2(a)':hex(r2),'ROTR13(a)':hex(r13),'ROTR22(a)':hex(r22),'Σ0(a)':hex(s0),'Maj':hex(maj)},result:hex(T2)}},{T2:hex(T2)},wordsScene([a,b,c,d,e,f,g,h],'第'+(t+1)+'轮 · T2'));
   const next=[(T1+T2)>>>0,a,b,c,(d+T1)>>>0,e,f,g];[a,b,c,d,e,f,g,h]=next;
   emit({phase:'更新寄存器',ruleId:'sha256-registers',action:'同时提交第'+(t+1)+'轮的8个新值',explanation:'所有新值读取同一份旧寄存器。新a等于T1加T2，新e等于旧d加T1；其余按规定移交。不能边改a边把新a当成旧值使用。',calculation:{formula:'(a,b,c,d,e,f,g,h) ← (T1+T2,a,b,c,d+T1,e,f,g)',values:{T1:hex(T1),T2:hex(T2)},result:next.map(hex).join(' ')}},{registers:next.map(hex)},wordsScene(next,'第'+(t+1)+'轮后的寄存器'));
  }
  const work=[a,b,c,d,e,f,g,h],previous=[...H];H=H.map((value,i)=>(value+work[i])>>>0);
  emit({phase:'块合并',ruleId:'sha256-chain',action:'把本块结果加回链式状态',explanation:'工作寄存器与进入本块前的8个状态字逐项相加，仍只保留低32位。这个结果成为下一个块的输入状态。',calculation:{formula:'H[i] ← H[i] + 工作寄存器[i] (mod 2³²)',values:Object.fromEntries(previous.map((v,i)=>['旧H'+i,hex(v)])),result:H.map(hex).join(' ')}},{chain:H.map(hex)},wordsScene(H,'本块合并后的链式状态'));
 }
 const digest=H.map(v=>v.toString(16).padStart(8,'0')).join('');
 emit({phase:'输出',ruleId:'sha256-output',action:'按顺序连接8个32位字',explanation:'8乘32等于256位，写成十六进制是64个字符。摘要用于比较内容变化，不是可解密的密文，也不能证明不存在碰撞。',calculation:{formula:'8 × 32 = 256 位 = 64 个十六进制字符',values:{'状态字':8,'每字位数':32},result:digest}},{digest},{kind:'text',title:'完整SHA-256摘要',text:[digest,'8个32位字，合计256位；这是固定长度摘要。']});
 return {digest,frames,trace:recorder.trace};
}
export const sha256Teaching:Runner=async(input,p,seed)=>{
 const a=str(p,'text','算法奇境'),b=str(p,'comparison','算法奇境!');if(a.length>1000||b.length>1000)throw new Error('教学输入最多1000个字符。');
 const target=input.traceTarget==='comparison'?b:a,detailed=sha256Detailed(target,seed),other=sha256Detailed(input.traceTarget==='comparison'?a:b,seed,false);
 const [da,db]=input.traceTarget==='comparison'?[other.digest,detailed.digest]:[detailed.digest,other.digest];
 const raw=new TextEncoder().encode(target),check=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(check!==detailed.digest)throw new Error('教学实现与浏览器标准摘要不一致，停止展示。');
 const bitsA=[...da].flatMap(c=>parseInt(c,16).toString(2).padStart(4,'0').split('').map(Number)),bitsB=[...db].flatMap(c=>parseInt(c,16).toString(2).padStart(4,'0').split('').map(Number));
 const different=bitsA.reduce((n,v,i)=>n+Number(v!==bitsB[i]),0),rec=detailed.trace;
 const id=String(rec.events.length);rec.events.push({id,phase:'对照',ruleId:'sha256-output',action:'比较两份真实摘要',explanation:'两份输入均用相同的标准规则计算。当前展开的是'+(input.traceTarget==='comparison'?'输入二':'输入一')+'的全部内部步骤；输出还与浏览器WebCrypto独立核对。不同位数不是固定50%，也不是不同文本必定不同摘要的证明。',frameIndex:detailed.frames.length,changes:[]});
 detailed.frames.push({scene:{kind:'grid',cols:32,rows:8,cells:bitsA.map((v,i)=>v!==bitsB[i]?'#f6c37b':v?'#78edd0':'#253b49'),title:'金色：两份摘要在这一位不同'},secondaryScene:{kind:'text',text:[da,db],title:'两份完整摘要'},caption:rec.events.at(-1)!.explanation,eventId:id});
 return {...result(detailed.frames,`两份摘要共有 ${different}/256 位不同。每一步均按标准位运算执行；可以切换查看另一份输入的内部步骤。`,{'输入字节':new TextEncoder().encode(a).length,'比较字节':new TextEncoder().encode(b).length,'变化位数':different,'摘要位数':256,'变化比例 %':round(different/256*100),'摘要':da,'比较摘要':db}),trace:rec};
};
