# Remotion 制作环境验证

此目录目前包含技术探针，**不属于正式算法教学内容**。

- 精确依赖：`remotion`、`@remotion/player`、`@remotion/cli` 均为 `4.0.538`，复用根项目 React `19.2.0` 与锁文件。
- 交互预览：在项目根运行 `npx vite --config media/remotion/vite.config.ts`，访问 http://127.0.0.1:5190/ 。
- Studio：`npx remotion studio media/remotion/studio.tsx --no-open --port 5191`，访问 http://localhost:5191/RemotionGate 。
- 技术计算检查：`npx tsx --test media/remotion/smoke.test.ts`。
- 类型检查：`npx tsc --project media/remotion/tsconfig.json`。
- 浏览器检查：保持两项预览运行，执行 `node qa/v2-env-remotion.mjs`。
- MP4 技术输出：`output/capability.mp4`，H.264、1280×720、30fps、3秒；仅证明渲染链可用，不满足正式视频时长或教学质量标准。

已验证：起点原生拖动、修改终点、添加障碍导致不可达、真实重新计算、播放暂停、逐帧前后、跳转、重置、Studio、MP4 编码与浏览器解码。

桌面与 390px 布局截图位于 `qa/v2-env-remotion-*.png`。手机仅验证无横向溢出；横版视频缩放后的中文字仍过小，正式版应提供全屏与配套文字/竖版重点视图，不能把此探针截图当作手机教学可读性验收。

正式接入时应替换技术探针计算器，使用主站统一事件轨迹；保持播放器只负责时间与呈现，输入变化后暂停并回到新轨迹起点。
