import {compressionLessons} from './intelligence-compression';
import {retrievalLessons} from './intelligence-retrieval';
import {modelLessons} from './intelligence-models';
import {predictionLessons} from './intelligence-prediction';
import type {LessonDefinition} from '../../engine/teaching';
import {sha256Lesson} from './sha256';
export const lessons:LessonDefinition[]=[{
 algorithmId:'kmeans',version:2,variant:'Lloyd K-means；二维欧氏距离；空组保留旧中心；同分选较小编号；最多30轮',prerequisites:['平均数','距离远近'],
 analogy:{title:'给顾客分组，就像反复调整聚会集合点',story:'六位朋友住在城市不同位置，要分成两个集合小组。先放两个集合点，每个人去较近的一个；再把每组集合点搬到成员坐标的平均位置。搬完后，有些人可能改去另一个集合点，所以需要再比较一次。',mappings:[{everyday:'朋友住在哪里',algorithm:'每个顾客的两个同尺度特征，画成一个二维数据点',ruleIds:['kmeans-init']},{everyday:'选择较近的集合点',algorithm:'计算到所有中心的距离平方，分给最小的一组',ruleIds:['kmeans-nearest']},{everyday:'把集合点搬到成员中间',algorithm:'固定分组，分别平均横坐标和纵坐标',ruleIds:['kmeans-mean']},{everyday:'大家都不再换集合点',algorithm:'归属不变时停止；当前结果可能只是局部解',ruleIds:['kmeans-stop']}],limit:'这里用平面直线距离平方，不考虑道路、拥堵和人数上限。“平均位置”不保证现实中有可用场地。'},
 rules:[{id:'kmeans-init',title:'先指定组数，再给出初始中心',statement:'组数K由你指定。这里从数据点中按固定种子抽取中心，可能抽到重复位置；初始化会影响结果。',sourceIds:['kmeans-d1']},{id:'kmeans-nearest',title:'每个点交给最近的中心',statement:'逐个比较所有中心的距离平方，最小值获选。同分时选编号较小者，其他中心仅在本轮被排除。',formula:'d² = (x − cx)² + (y − cy)²',sourceIds:['kmeans-d1']},{id:'kmeans-mean',title:'中心是当前成员的平均坐标',statement:'先固定归属，再分别平均横坐标和纵坐标。这最小化当前组的距离平方和；空组保留旧中心。',formula:'cx = Σx / n，cy = Σy / n',sourceIds:['kmeans-d1']},{id:'kmeans-stop',title:'重复比较，直到归属不变',statement:'中心移动后重新分配。归属不再变化时停止；最多运行30轮，达到上限会明确提示。即使稳定也不保证全局最优。',formula:'SSE = Σ 每个点到其中心的距离平方',sourceIds:['kmeans-d1']}],
 teachingCase:{seed:42,params:{k:2,shape:'clusters',noise:0},input:{points:[{x:18,y:24},{x:24,y:28},{x:20,y:18},{x:72,y:68},{x:80,y:76},{x:76,y:62}]}},
 chapters:[{id:'analogy',title:'从集合点理解分组',ruleIds:['kmeans-init']},{id:'assign',title:'比较距离，决定归属',ruleIds:['kmeans-nearest']},{id:'update',title:'求平均，移动中心',ruleIds:['kmeans-mean']},{id:'finish',title:'为什么还要再来一轮',ruleIds:['kmeans-stop']}],
 questions:[{kind:'next',prompt:'一个点到两个中心的距离平方分别为25和9，下一步会怎样？',options:['分给距离平方为9的中心','分给人数较少的组','任选一个，反正以后会变'],correct:0,explanation:'本实验按最近中心分配；人数多少不是这一步的选择依据。'},{kind:'alternative',prompt:'某组成员横坐标为10、20、30，为什么不把中心随意放在10？',options:['10不是合法坐标','平均位置20使这组距离平方和最小','中心只能放在没有成员的位置'],correct:1,explanation:'在固定分组时，均值最小化平方距离。中心不必落在某个真实数据点上。'},{kind:'change',prompt:'把同一批环形数据交给K-means，会自动知道内外两圈才是两组吗？',options:['会，所有形状都能准确识别','不一定，它更偏好围绕中心的紧凑分组','增加播放速度就能识别'],correct:1,explanation:'算法优化的是距离平方和，不是人类看到的任意形状；可对照DBSCAN理解不同假设。'}],
 misconception:'颜色变化与中心移动是两个不同步骤。K-means并不是一次看懂所有群体，也不会保证找到全局最好的分组。',references:[]
},sha256Lesson,...predictionLessons,...modelLessons,...retrievalLessons,...compressionLessons];
