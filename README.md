# 青铜门 · 长白山

《盗墓笔记》长白山青铜门交互 3D 场景。**所有几何、纹样、材质、粒子、音效均由代码程序化生成**，没有导入模型、图片或音频素材。

- 技术栈：three.js 0.186.1 + Vite + postprocessing + three-custom-shader-material + camera-controls + Tone.js + simplex-noise
- v3 修订：节点 1 的 7 m 宽/13 m 高雪埋竖缝与暖光喉道、240×96 位移+法线崖壁；节点 3B 240×240 火山岩地面 + 8600 中小碎岩 + 全谷骨毯 + 6 m 纵深门框/门环浮雕；节点 4–7 共用同一地面/骨层；PCF 实时阴影（手电/照明弹/门面掠射）
- 画布：WebGL2，桌面目标 60fps，`quality=low` / 移动端自动降级
- 验收产物：`dist/`、`shots/node1..7.png`、`shots/node3-overhead.png`、`shots/node3-flare.png`、`shots/node3-floor.png`、`shots/node6-open/enter/close.png`、`shots/console.json`、`shots/stats.json`、`REVIEW.md`

## 运行

```bash
cd /workspace/qingtongmen/dsh
pnpm install
pnpm dev          # 开发预览
pnpm build        # 生成 dist/
pnpm preview      # 预览 dist/（端口 4173）
```

浏览器打开 `http://localhost:5173/`（开发）或 `http://localhost:4173/`（构建产物）。
`?quality=low` 可手动进入低画质；触屏或宽度 `< 820px` 时自动低画质。
`?nopost=1` 可关闭后期，仅用于诊断。

### 重新截图与统计

需要全局 Playwright 与 Chrome：

```bash
pnpm build
node scripts/shoot.cjs   # 自动启动 vite preview、抓控制台、截 13 张图
node scripts/stats.cjs   # 单独重算像素统计（shoot 已自动调用）
```

`shoot.cjs` 固定 1600×900、`?quality=high`，使用
`/usr/bin/google-chrome` + `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。
截图前会清理非最终命名的 png，输出：

| 文件 | 内容 |
|---|---|
| `shots/node1.png` | 雪谷入口：崖底斜仰、7m 宽/13m 高雪埋竖缝与暖光/蒸汽、240×96 位移+法线崖壁、1.70m 人影、30m 标尺、暴风雪 |
| `shots/node2.png` | 地热岩缝：窄陡下爬、湿亮岩壁、壁缝/地缝蒸汽、底部浅积水 |
| `shots/node3.png` | 3A 锁链俯视（暗光手电） |
| `shots/node3-overhead.png` | 3A 宽俯视：尸链与嵌岩门体 |
| `shots/node3-flare.png` | 照明弹峰值：整谷骨堆、角砾岩、崖壁门体 |
| `shots/node3-floor.png` | 3B 谷底低机位：极不平火山岩+全谷骨毯，门框纵深/门环/浮雕在冷光里 |
| `shots/node4.png` | 青铜门全景（30×60m 比例尺、6m 石作门框、门环/门楣浮雕、人皮封条、同一套谷底） |
| `shots/node5.png` | 门纹特写（「推演」） |
| `shots/node6.png` | 阴兵借道（「再见」时刻） |
| `shots/node6-open.png` | 门开 / 火光 / 淡蓝雾 |
| `shots/node6-enter.png` | 四人一列入门 |
| `shots/node6-close.png` | 门合拢（49.8s） |
| `shots/node7.png` | 尾声「十年」2015 |
| `shots/console.json` | console error + pageerror，目标 0 |
| `shots/stats.json` | 亮度 / 纯黑 / 过曝 / 截断统计 |

页面暴露给自动化的钩子：`window.__ready`、`window.__nodeSettled`、`window.__node`、
`window.__goto(n)`、`window.__seek6(t)`、`window.__flare()`、`window.__replay6()`、
`window.__riftBeat(1|'floor')`、`window.__riftView('high'|'wide'|'floor')`、`window.__setPost(false)`。
`__riftBeat(1)` 回到 3A 俯视，`__riftBeat('floor')` 切到 3B；第二参数 `true` 可立即切镜。

## 七个节点

| # | 节点 | 场景与交互 | 原文卡片 |
|---|---|---|---|
| 1 | 雪谷入口 | 谷底斜仰的 30m 崖壁；两片 13m 岩板夹出约 7m 宽竖缝，雪堆半掩缝口，缝内暖光/蒸汽从 6m 深喉道透出；崖壁 240×96 噪声位移 + 法线岩纹 + 竖向岩肋 + 雪檐；1.70m 人影、断树、30m 标尺、侧向暴风雪 | 大结局（下）第二十九章「故地」 |
| 2 | 地热岩缝 | 窄而陡的撕裂岩缝，湿亮发烫的岩壁；壁缝与地缝向上冒蒸汽、淡黄绿硫磺雾；底部只有浅积水，不设发光泉眼/人工门洞 | 大结局（下）第二十九章「故地」 |
| 3A | 裂谷 · 锁链俯视 | 从高处穿过悬挂尸体的锁链下望；按 F 打照明弹，整谷骨堆与角砾岩瞬间照亮；门嵌在粗糙火山岩崖壁 | 云顶天宫篇 第五十章「守护神」的巢穴 |
| 3B | 裂谷 · 谷底行走 | 低机位踩在骨毯上走向门；240×240 极不平黑色火山岩地面 + 8600 中小碎岩 + 720 板岩 + 全谷骨毯；背景门有 6m 石作门框、门楣/门垛浮雕、门环、门内漏光与掠射阴影 | 同上 |
| 4 | 青铜门全景 | 两扇 30×60m 巨门、6m 进深石作门框、门楣/门垛浮雕、3.9m 门环、门缝冻血人皮、1.75m 人物剪影、30m/60m 尺度线；与 3B/5–7 同一套火山岩/骨层 | 云顶天宫篇 第五十章 |
| 5 | 门纹特写 | 可拖拽/缩放的环视（camera-controls），云雷纹、饕餮式铸纹、铭文带；明确标注「推演」 | 云顶天宫篇 第五十章 |
| 6 | 阴兵借道 | 52s 完整时间线：人皮爆裂 → 门向外滑开 → 缝内火光 → 淡蓝雾上升 → 鹿角号 → 四人一行入门 → 张起灵回头「再见」→ 地面震动关门；可重播 | 云顶天宫（下）第四十五章 永远无法解开的谜团 |
| 7 | 尾声 · 十年 | 2015 雪光、门缝火光、前景岩台两个剪影与台上碎骨、字幕「走吧」；与节点 3–6 共用同一套谷底岩块/尸骨 | 《十年》（转引自人民网 2015-08-18） |

### 交互

- `←` / `→`、`↑` / `↓`、`PageUp/PageDown`、空格：切换节点；数字 `1–7` 直达
- 底部圆点 / 左右箭头：切换节点
- 滚轮：推进/后退（节点 5 的滚轮用于 Orbit 缩放，避免与环视冲突）
- 节点 3：鼠标移动手电方向；`F` 或右下按钮发射照明弹；`B` 或侧栏按钮在 3A/3B 间切换
- 节点 5：左键拖拽旋转、滚轮缩放、双击复位
- 节点 6：`R` / 重播按钮重播；侧栏有 52s 进度与阶段文案
- 右上角「音效」：需用户手势启动 WebAudio；全部由 Tone.js 合成（风、低频轰鸣、鹿角号、门裂、撞击）

## 原文对照（卡片的引文以 SCENE_SOURCE.md 为准）

> 摘录均为 SCENE_SOURCE.md 中的短句；不同转载站章节号不同，正版以出版书为准。

| 节点 | 原文短句 | 出处 |
|---|---|---|
| 1 | 「雪谷」「三十米高的悬崖」「暴风雪」 | 大结局（下）第二十九章「故地」 https://m.tedu.cc/newbook/1417370/17850380.html |
| 2 | 「被雪掩埋的缝隙」「温泉」 | 同上 |
| 3 | 「这条地下裂谷太大」「谷底…全是极度不平整的黑色的火山岩块」「从上面跌落的尸骨，层层叠叠」「裂谷地下一边的崖壁上，有一扇两面的青铜巨门」 | 三叶屋 云顶天宫篇 第五十章 https://www.sanyewu.com/0/965/586561.html |
| 4 | 「门高在三十米所有，宽度将近六十米」「十层楼这么高」「上万吨重」「看上去竟然像是整体铸造起来的」 | 同上 |
| 5 | 「极其精美的花纹」「复杂程度简直让人头皮发麻」 | 同上 |
| 6 | 「排成一列长队」「四人一行，行走极为整齐」「奇长的人脸…长度要比普通人长一倍」「脸色极度苍白」「好像是纸糊的一样」「一连串鹿角号声从裂谷的一端传来」 | 大道不孤 云顶天宫（下）第四十五章 https://www.daomubiji.com/yun-ding-tian-gong-55.html |
| 6（门开/张起灵） | 「全部爆裂脱落」「向外挪开了一点」「近处几乎可以开进一辆卡车」「门缝内的黑暗中，突然亮起了好几盏火光」「冒起一股淡蓝色的薄雾，犹如云浪一样，迅速上升」「右手托这一只奇怪的印玺」「再见」 | 三叶屋 第五十四/五十五章 https://www.sanyewu.com/0/965/586566.html 、 https://www.xiaoshuohu.com/0/680/586281.html |
| 7 | 「走吧」 | 《十年》2015-08-17，转引自人民网 http://media.people.com.cn/n/2015/0818/c40606-27480994.html |

### 推演说明

原文没有写门纹的具体图样。门上的**云雷纹 / 饕餮式**构图、铭文带和「黑金古刀 / 鬼玺」的具体造型均为程序化艺术推演，界面节点 5 明确标注「推演」，不采用任何影视改编造型、版权图片或外部模型。人面鸟只以远处叫声与黑暗中的剪影暗示，没有加入原文之外的怪物。

节点 2 的原文只写「温泉」。本场景按大结局「雪谷→温泉→裂谷」的缝隙语境，把它处理为**地热岩缝**（窄陡、湿烫、硫磺雾、浅积水），相关文案在卡片内标注「场景处理」，不冒充原文。节点 3 的「挂锁链下谷」是原著行动线，卡片引文仍只用 SCENE_SOURCE 中的短句。

## 技术实现

| 模块 | 实现 |
|---|---|
| 雪谷（节点 1） | simplex-noise 高度场 + 30m 垂直崖壁（240×96 位移 + Canvas 法线贴图 + bump）；两片倾斜 13m 岩板夹出 7m 竖缝，6m 凹入喉道、受热内壁、暖色点光/光晕/蒸汽、雪堆半掩、冰锥/岩齿；30m 标尺 + 1.70m 人影 + 断树 + 雪檐；GPU 雪/近景雪粒/雪幕/drift |
| 地热岩缝（节点 2） | 下降坡道 + 两侧撕裂岩壁 + 顶隙冷光；低粗糙度湿亮岩材质、壁缝/地缝蒸汽、硫磺雾、暗色浅积水；手持灯作主光，避免人工泉眼 |
| 裂谷（节点 3–7） | 230×250 / 240×240 段 ridged/阶梯火山岩地面；8600 中小碎岩 + 720 板岩 + 5200 碎屑（5 种程序化角砾，instanced）；7000 长骨 + 850 头骨 + 800 肋骨 + 2200 碎骨，60% 骨堆/40% 全谷，4–7 共用；黑有机质暗斑点到为止 |
| 青铜门 | 两扇 30m×30m、总宽 60m；2048×1024 程序化 Canvas 纹样 + 顶点位移浮雕（200×200 段）；新增 6m 进深 portal frame（3 层门垛、3 层门楣、9 托木、2 级门槛、侧 reveal/漏光）、门楣 5 个 8.2×3.8m 浮雕、门垛 6 个 4.6m 浮雕、3.9m 门环、重肋/乳钉/门枢 |
| 门崖 | 门体嵌入粗糙火山岩：侧壁/门楣大位移岩板、角砾门套、玄武岩柱；新门框与门体之间是 6m 真实凹入，侧 reveal 由 portalReveals 打亮 |
| 尸链（3A） | 5 条从裂谷顶垂下的锁链（InstancedMesh 环链），链上悬挂多具程序化尸体；3A 镜头从高处穿过链条下望 |
| 3A/3B | 两个 authored 机位与灯光 mood；`__riftBeat`/`__riftView` 切换；3B 立即重置照明弹，保证低机位黑暗可复现 |
| 照明弹 | 独立点光 + 谷底泛光（A/B/C/D/E 侧洗）+ 低角度定向光（1024 阴影）；按 F 触发，约 9s 熄灭；截图固定在峰值；3A 关闭体积光锥，3B 低强度开启 |
| 阴兵 | 48 个 InstancedMesh 部件组成 12 排 × 4 列；长脸（平面纸脸 + 拉长头部）、破旧甲片、番旗、号角、漂浮步态 |
| 张起灵 | 程序化低模人物，黑金古刀 + 鬼玺 + 青绿印章辉光；节点 6 中位于队尾，回头「再见」；HUD 角色标注 |
| 材质 | MeshStandardMaterial + three-custom-shader-material 在门面注入世界空间铜绿、凹陷积垢、粗糙度变化 |
| 后期 | postprocessing：HDR bloom → ACES tone mapping → Hue/Saturation → Brightness/Contrast → Vignette → Noise → FXAA；无双重 tone mapping |
| 灯光/阴影 | 冷裂谷主光、boneRake/boneFill/nearFill、门面 doorRake、门框 portalKey/lintelKey、门缝暖火光、照明弹泛光、节点 7 冷天光；PCF 阴影：手电 512、flareDoor 1024、doorRake 1024；骨骼/岩石/门体 cast，地面/门面 receive |
| 粒子 | 自写 GPU Points / billboard shader：雪、近景大雪粒、雪幕、蒸汽、蓝雾、尘埃、火星、人皮碎片 |
| 音频 | Tone.js 合成：棕噪声风、低频轰鸣、锯齿波+带通+混响鹿角号、噪声门裂/撞击；无外部音频 |
| UI | 中文侧栏原文卡、章节、出处链接、节点进度、3A/3B 按钮、尺度卡、Orbit 提示、字幕、音效开关；响应式移动端布局 |

`three.quarks` 已加入依赖清单，作为后续可替换的粒子后端保留；当前交付为保证 swiftshader 无头截图的确定性，爆发粒子使用自写 shader（`src/particles.js`）。

## 性能与降级

- 高画质：DPR 上限 1.6、bloom、Noise、FXAA、完整粒子/几何段数。
- 低画质：DPR 1、关闭 bloom / Noise / FXAA、降低岩壁段数、粒子与实例数量；移动端与 `?quality=low` 自动启用。
- PCF 实时阴影只开三盏灯（手电 512、flareDoor 1024、doorRake 1024），低画质主要降低几何/粒子；大量 InstancedMesh（碎岩/骨/锁链/阴兵部件）、Canvas 纹理一次生成并复用、门面顶点浮雕只在初始化时计算。
- 桌面目标 60fps；headless SwiftShader 仅用于验收截图，不代表真实 GPU 帧率。最终 headless shoot 13 张 PASS，boot 约 14.4 s。

## 自检结果（v3）

- `pnpm build`：成功（Vite 7，仅 chunk-size 提示，不是错误）。
- 控制台：**0 console error / 0 pageerror**（`shots/console.json` total=0）。
- 7 个节点、13 张验收截图全部可达并通过像素阈值（`shots/stats.json`：**13/13 PASS**，mean 15.30–60.82，max black 0.5895，max over 0.0000）。
- v3 关键改动、改前→改法→截图证据与已知取舍见 **`REVIEW.md`** 的 v3 节；v2 历史保留在同文件后半。

### v3 最终统计

（由 `node scripts/shoot.cjs` 生成，1600×900，`quality=high`。数字以 `shots/stats.json` 为准。）

| 截图 | mean | black | over |
|---|---:|---:|---:|
| node1 | 57.20 | 0.002 | 0.0000 |
| node2 | 15.30 | 0.590 | 0.0000 |
| node3 | 23.11 | 0.253 | 0.0000 |
| node3-overhead | 17.38 | 0.296 | 0.0000 |
| node3-flare | 60.82 | 0.003 | 0.0000 |
| node3-floor | 29.15 | 0.169 | 0.0000 |
| node4 | 31.32 | 0.151 | 0.0000 |
| node5 | 35.80 | 0.131 | 0.0000 |
| node6 | 29.41 | 0.216 | 0.0000 |
| node6-open | 36.18 | 0.109 | 0.0000 |
| node6-enter | 42.91 | 0.074 | 0.0000 |
| node6-close | 20.96 | 0.207 | 0.0000 |
| node7 | 48.20 | 0.172 | 0.0000 |

## 目录

```
index.html
src/
  main.js          状态机、镜头、3A/3B、后期、UI 钩子、节点 6 时间线
  rift.js          裂谷、角砾岩、骨层、尸链、青铜门、浮雕、人皮、门内火光、蓝雾
  valley.js        雪谷、30m 崖壁、雪埋竖缝、地热岩缝、蒸汽、浅积水
  ghosts.js        阴兵队列、番旗/号角、张起灵、节点 6 镜头关键帧
  textures.js      全部程序化 Canvas 纹理（门纹、皮、岩、雪、旗、火焰…）
  particles.js     雪/雪幕/雾/尘/火星/照明弹/皮片粒子
  audio.js         Tone.js 程序化声音
  style.css        中文 UI、侧栏、3A/3B 按钮、移动端
scripts/
  shoot.cjs        Playwright + swiftshader 截图/控制台收集
  stats.cjs        PNG 像素统计
shots/             验收截图与 console/stats 报告
dist/              pnpm build 产物
REVIEW.md          v3 自审记录（含改前→改法→截图证据/取舍）+ v2 历史
progress.log       阶段进度与 DONE-v3 自查
```

## 已知边界

- 阴兵为程序化低模 + 纸片脸，近看仍是风格化表达；番旗为程序化撕裂布片。
- 门纹为商周青铜器推演，不是原文描述的具体器物；界面已标注。
- 节点 2 的地热岩缝是「场景处理」，原文只写「温泉」；蒸汽为程序化 billboard 近似，未做流体模拟。
- 节点 3 的「挂锁链下谷」按原著行动线补足，SCENE_SOURCE 的引文表只摘录了裂谷/尸骨/照明弹相关短句。
- 节点 1 的风雪与崖壁细节在低画质下会进一步简化；30 m 标尺是场景内注释线。
- 3B 门面在 60–70 m 外仍以纹理为主体，厚度/纵深靠 6 m 门框、门环、重肋、浮雕与 doorRake 阴影建立；近看不是真实铸造扫描件。
- 骨毯/碎岩为实例化低模，极端近景会看到重复；3B 机位抬到 4.6 m 是为同时读到骨毯和门，不是严格人眼高度。
- 无头截图使用 SwiftShader，不代表真实 GPU 帧率；未部署 ship。
- 未在真实移动设备上做长时间帧率实测；已实现自动低画质路径。
