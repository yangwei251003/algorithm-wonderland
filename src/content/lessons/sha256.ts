import type {LessonDefinition} from '../../engine/teaching';
export const sha256Lesson:LessonDefinition={
 algorithmId:'sha256',version:2,variant:'FIPS 180-4 SHA-256；UTF-8输入；512位消息块；64轮压缩；教学实现与WebCrypto逐次核对',prerequisites:['二进制0和1','余数与固定长度'],
 analogy:{title:'一条固定配方的指纹流水线',story:'把一封信先装进等大的货箱，最后一箱带着原信的长度标签。每箱进入八台有刻度的搅拌器，按同一张配方表传递、选择和混合64轮，再把结果带给下一箱。所有货箱处理完，八台机器上的刻度拼成这封信的指纹。',mappings:[{everyday:'把信件变成一串可计数的小颗粒',algorithm:'文本先编码为UTF-8字节；汉字不等于一个字节',ruleIds:['sha256-bytes']},{everyday:'装满货箱，并写下原信长度',algorithm:'追加1、补0和64位长度字段，每箱512位',ruleIds:['sha256-padding']},{everyday:'为64轮准备配料单',algorithm:'16个消息字按移位、异或、加法扩展为64个W字',ruleIds:['sha256-schedule']},{everyday:'八台搅拌器按固定配方同步交接',algorithm:'a到h寄存器计算T1、T2，再同时更新；每块64轮',ruleIds:['sha256-registers','sha256-round']},{everyday:'上一箱的结果影响下一箱',algorithm:'工作寄存器加回链式状态，下一块继承该状态',ruleIds:['sha256-chain']},{everyday:'最后的八个刻度组成指纹',algorithm:'八个32位字拼成256位摘要',ruleIds:['sha256-output']}],limit:'“搅拌”只帮助理解依赖关系，真正运算是确定的逐位操作，不靠随机性。指纹不能还原信件；有限长度也意味着数学上必然存在碰撞。'},
 rules:[
 {id:'sha256-bytes',title:'输入是字节，不是屏幕上的字符数',statement:'先按UTF-8编码。中文和表情通常占多个字节；后续长度始终按编码后的位数计算。',sourceIds:['sha256-d1']},
 {id:'sha256-padding',title:'先写结束标记，再写原消息长度',statement:'追加1比特，补0到总长度模512等于448，再附64位大端原长度。每块512位。',formula:'原位数 + 1 + 补零数 + 64 ≡ 0 (mod 512)',sourceIds:['sha256-d1']},
 {id:'sha256-schedule',title:'扩展64个消息字',statement:'前16个32位字来自当前消息块；后48个由已知字经循环右移、逻辑右移、异或与加法得到。循环右移把移出的位绕回左侧，逻辑右移在左侧补0。x=W[t−15]，y=W[t−2]；σ₀把x右转7、18位与右移3位的结果逐位异或，σ₁把y右转17、19位与右移10位的结果逐位异或。异或时，每位有奇数个1就得1。',formula:'W[t]=W[t−16]+σ₀(W[t−15])+W[t−7]+σ₁(W[t−2]) mod 2³²；σ₀(x)=ROTR7(x)⊕ROTR18(x)⊕SHR3(x)；σ₁(y)=ROTR17(y)⊕ROTR19(y)⊕SHR10(y)',sourceIds:['sha256-d1']},
 {id:'sha256-registers',title:'八个寄存器同时更新',statement:'第一个块从标准初值出发。每轮的新值均取自同一份旧状态：新a=T1+T2，新e=旧d+T1，其余按规则传递。加法只保留低32位。',formula:'(a,b,c,d,e,f,g,h) ← (T1+T2,a,b,c,d+T1,e,f,g)',sourceIds:['sha256-d1']},
 {id:'sha256-round',title:'每轮先算T1、T2，再交接',statement:'Σ₁将e循环右移6、11、25位后异或；Σ₀将a循环右移2、13、22位后异或。异或逐位数1，奇数个得1、偶数个得0。Ch在e这一位为1时取f，为0时取g；Maj在a、b、c的对应位至少有两个1时取1，否则取0。K是标准常数，W是本轮消息字；没有搜索或淘汰候选。',formula:'T1=h+Σ₁(e)+Ch(e,f,g)+K[t]+W[t]；T2=Σ₀(a)+Maj(a,b,c)',sourceIds:['sha256-d1']},
 {id:'sha256-chain',title:'每块处理完，加回进入该块前的状态',statement:'64轮结束后，八个工作字分别加回原来的链式状态。后续块使用这个结果，不能独立计算每块再拼接。',formula:'H[i] ← H[i]+工作字[i] mod 2³²',sourceIds:['sha256-d1']},
 {id:'sha256-output',title:'输出固定长度摘要，再比较内容',statement:'顺序连接八个状态字得到256位，十六进制写成64字符。输入的细小变化通常会改变许多输出位，但不保证恰好一半，也不保证不同输入必定产生不同摘要。',formula:'8×32 = 256位 = 64个十六进制字符',sourceIds:['sha256-d1']}
 ],
 teachingCase:{seed:42,input:{traceTarget:'original'},params:{text:'abc',comparison:'abd'}},
 chapters:[{id:'analogy',title:'为什么可以给文本做指纹',ruleIds:['sha256-bytes','sha256-padding']},{id:'schedule',title:'从16个字扩展到64个',ruleIds:['sha256-schedule']},{id:'round',title:'拆开第一轮的真实计算',ruleIds:['sha256-round','sha256-registers']},{id:'finish',title:'64轮、块合并与最终摘要',ruleIds:['sha256-chain','sha256-output']}],
 questions:[{kind:'next',prompt:'某块64轮运算结束后，接下来做什么？',options:['把工作寄存器加回进入本块前的链式状态','把本块摘要直接写到最终字符串后面','随机再选一套常数'],correct:0,explanation:'块合并是固定步骤；它把本块处理结果传给下一块。'},{kind:'alternative',prompt:'为什么更新a后，不能立即用这个新a给b赋值？',options:['b必须永远等于0','规定所有新值都读取同一份旧状态','新a的数字太大'],correct:1,explanation:'b接收的是旧a。混用新旧状态会改变标准算法，摘要将不再符合SHA-256。'},{kind:'change',prompt:'把abc改成abd，256位摘要会恰好改变128位吗？',options:['一定会，这是公式规定的','不一定，需要实际算；一半只是统计上的直觉','不会，只有最后一位改变'],correct:1,explanation:'雪崩效应不是每次固定改变一半位数。实验显示的是当前两份输入实际不同的位数。'}],
 misconception:'SHA-256是摘要算法，不是加密算法。没有密钥可供“解密”，单次摘要也不应被当作完整的密码存储方案。',references:[]
};
