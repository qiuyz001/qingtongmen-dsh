# 青铜门 three.js 交互场景 · 项目规划（待 Randy 确认）

## 1. 体验分镜 / 可交互节点（滚动或点击切换，镜头用 GSAP 或 three 补间过渡）
1. 雪山入口：长白山雪谷、30 米崖壁、暴风雪粒子 → 被雪掩埋的缝隙（大结局）
2. 缝隙 / 温泉：窄岩缝、暖色蒸汽，冷烟火照出岩壁壁画（云顶天宫下）
3. 地下裂谷：黑色火山岩、尸骨堆，手电光锥只照到一小块；按键「照明弹」→ 整个谷底亮起
4. 青铜巨门全景：30×60 米（以人物剪影作比例尺）、程序化繁复花纹、门缝的青灰冻血人皮
5. 门纹特写：可以拖拽镜头，看花纹的法线和金属锈蚀（纹样原文没写，标注为「艺术推演」）
6. 门开 + 阴兵借道（核心动画）：人皮爆裂 → 门开一条缝，缝里亮起火光 → 石缝涌出淡蓝雾 → 鹿角号声 → 四人一行、举番旗的长脸阴兵飘进门；闷油瓶背刀托鬼玺混在队里，回头「再见」→ 地面一震，门合上
7. 尾声「十年」：雪光里门再开，「走吧」（字幕，可选）
UI：右侧原文短句卡片，每节注明出处；时间轴 2005 / 2015 切换；音效开关。

## 2. 技术方案
- three.js + Vite + pnpm，打包后部署静态站点（dist）。同时导出单 HTML 备份版。
- 全部程序化：门用 ExtrudeGeometry 加 shader 程序化浮雕/噪声纹样，铜绿 PBR；岩壁用噪声位移的平面；阴兵用 InstancedMesh 低模加纸片感材质。
- 后期：EffectComposer + UnrealBloom、FogExp2 + 体积雾 shader、粒子（雪、雾、灰尘）、手电 SpotLight、照明弹 PointLight 闪烁。音效用 WebAudio 程序合成鹿角号和低频轰鸣，不用版权音频。
- 性能：手机降级档（关 bloom、少粒子），目标桌面 60fps。
- 给两个 agent 装的 skills：CloudAI-X/threejs-skills、scottstts/Threejs-Awesome-Graphics-Agent-Skills。

## 3. 验收循环
- 盒子 /workspace/webgltest 已验证：playwright + swiftshader 可以 headless 截图。
- 每轮：pnpm build → 起本地预览 → 7 个节点各截一张图 + 抓控制台报错 → 模型看图自评（是否过曝、黑屏、比例）→ 再改。至少 3 轮，最终截图对照 BRIEF 验收表。

## 4. 两条线（同一份 BRIEF.md）
- A 线 DSH（DeepSeek）：当前默认是 `deepseek-flash`。`dsh headless` 没有命令行参数可选模型或档位，要用 `--patch overlay.yml` 改 agent-default-model 的 model，并设 reasoningEffort（schema 里有 reasoningEffort / thinking / forceAdaptiveThinking 字段）。最高档的取值（max/high）和 Pro 模型名**待开跑前用 --dump-config-schema 确认**。工作目录 /workspace/qingtongmen/dsh/。
- B 线 kimi小b：通过 SendToAgent 发同一份 BRIEF，用 Kimi 最高思考模式；它在自己那边产出，交回链接或打包文件，由我统一截图验收。
- 部署：两版各自部署一个 ship.place 链接，外加一个对比页。

## 5. 预计时长
- 调研规划：已完成。
- 每条线首版：参考 Invisible Cities 53–85 分钟；DeepSeek 做复杂场景在 X 上有 4 小时的案例，预计 **1.5–4 小时**，两条线并行。
- 截图修正 + 部署：0.5–1 小时。
- 合计墙钟时间约 **2.5–5 小时**；因为后台任务可能中断，按断点续跑来设计。
