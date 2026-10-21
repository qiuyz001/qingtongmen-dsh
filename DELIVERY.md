# DELIVERY — 青铜门 · 长白山（DSH / Flash 1017）

## 可访问链接

**https://subdued-jersey-w7n6d.ship.place/**

- 平台：ship.page 免费 drop（Vite `dist/`：index.html + assets）
- 到期：**2026-11-19 19:30（Asia/Shanghai）**（API `expires_at` 2026-11-19T11:30:55Z）
- 认领延长：见本目录私有文件 `ship-response.json` 的 `claim_url`（含 token，勿写入 GitHub / README / 公开仓库）

## 本地路径（Grok Bot 机器）

| 项 | 路径 |
|---|---|
| 源码 | `/workspace/qingtongmen/dsh/` |
| 构建产物 | `/workspace/qingtongmen/dsh/dist/` |
| 截图 | `/workspace/qingtongmen/dsh/shots/`（11 张 + stats.json + console.json） |
| 自审 | `REVIEW.md` |
| 需求 | `/workspace/qingtongmen/BRIEF.md` |
| 部署包 | `qingtongmen-ship.zip` |
| 部署响应（含认领 token） | `ship-response.json` |

## 独立验收（2026-10-20 19:30 Asia/Shanghai）

| 验收项 | 结果 | 证据 |
|---|---|---|
| `pnpm build` | 通过 | 本机重跑成功；仅 chunk-size 警告；dist 1.3M |
| 控制台 0 error | 通过 | `shots/console.json` total=0，pageErrors=[] |
| 7 节点截图 stats | 通过 | `shots/stats.json` 11/11 PASS；mean 12.54–62.73；max black 0.542；max over 0.0002 |
| 门 30×60 m | 通过 | node4 尺度线 + 1.75m 剪影 + 侧栏尺度卡 |
| 人皮封条 | 通过 | `rift.js` 门缝石化人皮背衬；节点 6 时间线 T&lt;7.9s 可见并爆裂 |
| 淡蓝雾 | 通过 | node6-open / node6-enter |
| 阴兵四人一行 | 通过 | node6 / node6-enter；12×4 队列 |
| 鬼玺 + 黑金古刀 | 通过 | node6 HUD「张起灵 · 黑金古刀 · 鬼玺」+ 角色模型 |
| 门开→入门→闭合 | 通过 | node6-open / enter / close；52s 可重播 |
| 每节点原文卡 | 通过 | 侧栏 chapter/quote/source；节点 5 标「推演」 |

模型：全程 `deepseek-flash`（Flash 1017）+ reasoningEffort max（见 `flash-max.patch.yml`）。未启动修补轮。

## 已知问题 / 取舍

- 阴兵与温泉为风格化低模；近景精度不及离线渲染。
- 节点 2 温泉偏「发光泉眼」；节点 3 刻意极暗（手电小光池），照明弹帧才照亮谷底。
- 门纹为商周青铜器程序化推演（界面已标「推演」），非影视造型。
- 未做真实 GPU 60fps 实测；提供 quality 降级。
- JS 单包约 1.26 MB（gzip ~326 KB），Vite chunk-size 提示未拆包。

## 代表截图

- `/workspace/qingtongmen/dsh/shots/node4.png` — 青铜门全景 + 30×60 尺度
- `/workspace/qingtongmen/dsh/shots/node6-enter.png` — 阴兵四人一行入门 + 蓝雾
- `/workspace/qingtongmen/dsh/shots/node6.png` — 「再见」+ 张起灵标注
