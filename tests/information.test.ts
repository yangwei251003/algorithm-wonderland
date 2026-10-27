import test from 'node:test';
import assert from 'node:assert/strict';
import {informationRunners as run,rleEncode,rleDecode,huffmanEncode,huffmanDecode,lzEncode,lzDecode,hammingEncode,hammingCorrect,crcRemainder} from '../src/algorithms/intelligence-information';

test('14个信息算法默认完成，结果确定且指标不含非有限值',async()=>{
 assert.equal(Object.keys(run).length,14);for(const [id,runner]of Object.entries(run)){const a=await runner({},{},42),b=await runner({},{},999);assert.deepEqual({...a,trace:a.trace?{...a.trace,seed:0}:undefined},{...b,trace:b.trace?{...b.trace,seed:0}:undefined},id);assert.ok(a.frames.length>0,id);assert.ok(a.summary.length>10,id);for(const [key,v]of Object.entries(a.metrics))if(typeof v==='number')assert.ok(Number.isFinite(v),`${id}:${key}`);}
});
test('PageRank守恒，处理悬挂节点，零阻尼得到均匀分布',async()=>{
 const out=await run.pagerank({},{links:'A>B,B>C',damping:.85},1);assert.equal(out.metrics['最高排名'],'C');assert.ok(Math.abs(Number(out.metrics['分数总和'])-1)<1e-7);const uniform=JSON.parse(String((await run.pagerank({},{links:'A>B,B>C',damping:0},1)).metrics['分数']));for(const x of uniform)assert.ok(Math.abs(x-1/3)<1e-10);
});
test('协同推荐会响应评分，并明确冷启动；内容余弦只看偏好方向',async()=>{
 const a=await run.collaborative({},{ratings:'5,0,4,0,1,0'},1),b=await run.collaborative({},{ratings:'1,0,1,0,5,0'},1);assert.notEqual(a.metrics['预测分'],b.metrics['预测分']);assert.equal((await run.collaborative({},{ratings:'0,0,0,0,0,0'},1)).metrics['输入有效'],0);const c=await run['content-recommendation']({},{adventure:1,humor:2,science:2},1),d=await run['content-recommendation']({},{adventure:2,humor:4,science:4},1);assert.equal(c.metrics['首选'],d.metrics['首选']);assert.equal(c.metrics['最高相似度 %'],d.metrics['最高相似度 %']);assert.equal((await run['content-recommendation']({},{adventure:0,humor:0,science:0},1)).metrics['首选'],'尚无偏好');
});
test('推荐的最终高亮指向最高分，而不是最后计算的候选',async()=>{for(const id of ['collaborative','content-recommendation']){const out=await run[id]({},{},1),scene=out.frames.at(-1)!.scene;assert.equal(scene.values![scene.active![0]],Math.max(...scene.values!));}const zero=await run['content-recommendation']({},{adventure:0,humor:0,science:0},1);assert.deepEqual(zero.frames.at(-1)!.scene.active,[]);});
test('Apriori频繁项集和规则置信度符合手工计数',async()=>{
 const p={transactions:'A,B;A,B;A;B',support:50,confidence:60},out=await run.apriori({},p,1);assert.equal(out.metrics['频繁组合'],3);assert.equal(out.metrics['规则数'],2);const rules=JSON.parse(String(out.metrics['规则']));for(const r of rules){assert.equal(r.support,.5);assert.ok(Math.abs(r.confidence-2/3)<1e-8);}assert.equal((await run.apriori({},{...p,confidence:70},1)).metrics['规则数'],0);
});
test('BM25词匹配与无匹配情境',async()=>{
 assert.equal((await run.bm25({},{query:'维护'},1)).metrics['最高匹配'],'设备巡检记录');assert.equal((await run.bm25({},{query:'qwerty不存在'},1)).metrics['最高匹配'],'无匹配');assert.equal((await run.bm25({},{query:'无人机巡检'},1)).metrics['查询词数'],2);
});
test('加权编辑距离处理替换、空串与Unicode字符',async()=>{
 assert.equal((await run['edit-distance']({},{from:'kitten',to:'sitting'},1)).metrics['编辑代价'],3);assert.equal((await run['edit-distance']({},{from:'ab',to:'ac',substitution:3},1)).metrics['编辑代价'],2);assert.equal((await run['edit-distance']({},{from:'',to:'abc'},1)).metrics['编辑代价'],3);assert.equal((await run['edit-distance']({},{from:'猫🙂',to:'猫🙃'},1)).metrics['编辑代价'],1);
});
test('KMP识别重叠匹配，不存在片段时明确返回零',async()=>{
 const out=await run.kmp({},{text:'AAAAA',pattern:'AAA'},1);assert.equal(out.metrics['位置'],'0,1,2');assert.equal(out.metrics['出现次数'],3);assert.equal((await run.kmp({},{text:'abc',pattern:'xyz'},1)).metrics['出现次数'],0);assert.equal((await run.kmp({},{text:'abc',pattern:''},1)).metrics['输入有效'],0);
});
test('RLE/Huffman/LZ77对空串、重复、Unicode与多种窗口无损还原',()=>{
 const texts=['','A','AAAAAA','BANANA_BANDANA','ABRACADABRA_ABRACADABRA','猫猫狗狗🙂🙂猫','\n\n  abcabcabc','A'.repeat(100)];for(const s of texts){assert.equal(rleDecode(rleEncode(s)),s);const h=huffmanEncode(s);assert.equal(huffmanDecode(h.bits,h.codes),s);const codes=Object.values(h.codes);for(let i=0;i<codes.length;i++)for(let j=0;j<codes.length;j++)if(i!==j)assert.ok(!codes[j].startsWith(codes[i]),'码字必须前缀无歧义');for(const window of [4,8,16,32])assert.equal(lzDecode(lzEncode(s,window)),s);}assert.equal(huffmanEncode('BANANA').bits.length,9);
});
test('压缩指标包括定义的格式开销，不虚构短文本一定变小',async()=>{
 const short=await run.rle({},{text:'ABCD',repeat:1},1);assert.ok(Number(short.metrics['编码位数'])>Number(short.metrics['原文位数']));const long=await run.rle({},{text:'A'.repeat(100),repeat:1},1);assert.ok(Number(long.metrics['编码位数'])<Number(long.metrics['原文位数']));const h=await run.huffman({},{text:'BANANA',repeat:1},1);assert.equal(h.metrics['载荷位数'],9);assert.ok(Number(h.metrics['含码本总位数'])>Number(h.metrics['载荷位数']));const l=await run.lz77({},{text:'ABCDABCDABCD',window:8},1);assert.equal(l.metrics['还原一致'],'是');
});
test('Hamming(7,4)穷举16个数据和全部单比特位置都能纠正；双错不误报为成功',async()=>{
 for(let data=0;data<16;data++){const raw=data.toString(2).padStart(4,'0'),encoded=hammingEncode(raw);assert.equal(hammingCorrect(encoded).data,raw);for(let i=0;i<7;i++){const damaged=Array.from(encoded);damaged[i]=damaged[i]==='1'?'0':'1';const corrected=hammingCorrect(damaged.join(''));assert.equal(corrected.syndrome,i+1);assert.equal(corrected.data,raw);}}
 const double=await run.hamming({},{data:'1011',flip:3,flip2:5},1);assert.equal(double.metrics['实际翻转位数'],2);assert.equal(double.metrics['恢复原文'],'否');assert.match(double.summary,/超出|两位/);
});
test('CRC已知向量、单比特检错与可构造的未检出错误',async()=>{
 assert.equal(crcRemainder('11010011101100'+'000','1011'),'100');const clean=await run.crc({},{data:'11010011101100',polynomial:'10011',error:'0'},1);assert.equal(clean.metrics['检出错误'],'否');const encoded=String(clean.metrics['编码']);assert.equal(crcRemainder(encoded,'10011'),'0000');for(let bit=0;bit<encoded.length;bit++){const out=await run.crc({},{data:'11010011101100',polynomial:'10011',error:'1'+'0'.repeat(bit)},1);assert.equal(out.metrics['检出错误'],'是');}const hidden=await run.crc({},{data:'11010011101100',polynomial:'10011',error:'10011'},1);assert.equal(hidden.metrics['检出错误'],'否');assert.ok(Number(hidden.metrics['翻转位数'])>0);assert.match(hidden.summary,/未检出/);
});
test('Bloom筛选器对已加入项目无漏报，并能展示真实误报',async()=>{
 const keys='苹果,香蕉,橙子,葡萄,梨,桃子,西瓜,荔枝';for(const query of keys.split(','))assert.equal((await run.bloom({},{keys,query,size:16,hashes:5},1)).metrics['筛选结论'],'可能存在');let falsePositive=false;for(let i=0;i<80;i++){const out=await run.bloom({},{keys,query:'测试'+i,size:16,hashes:5},1);if(out.metrics['本次误报']==='是'){falsePositive=true;assert.equal(out.metrics['实际加入'],'否');break;}}assert.ok(falsePositive);
});
test('SHA-256符合公开标准向量，同内容不改变摘要',async()=>{
 const abc=await run.sha256({},{text:'abc',comparison:'abc'},1);assert.equal(abc.metrics['摘要'],'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.equal(abc.metrics['变化位数'],0);const empty=await run.sha256({},{text:'',comparison:'a'},1);assert.equal(empty.metrics['摘要'],'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');assert.ok(Number(empty.metrics['变化位数'])>0);
});
test('可达的长输入不会静默截断，SHA摘要计算完整长文本',async()=>{
 assert.throws(()=>run.rle({},{text:'a'.repeat(121)},1),/字符上限/);assert.throws(()=>run['edit-distance']({},{from:'a'.repeat(31),to:'b'},1),/字符上限/);
 const long='a'.repeat(500),out=await run.sha256({},{text:long,comparison:long+'b'},1);assert.equal(out.metrics['输入字节'],500);assert.ok(Number(out.metrics['变化位数'])>0);
});
