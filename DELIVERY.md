# DELIVERY — 青铜门 · 长白山（DSH / Flash 1017 · v3）

## 可访问链接

**https://tall-curler-4eyhu.ship.place/**

- 平台：ship.page 免费 drop（Vite `dist/`：index.html + assets）
- 到期：**2026-11-20 14:36（Asia/Shanghai）**（API `expires_at` 2026-11-20T06:36:12Z）
- 认领延长：见本目录私有文件 `ship-response.json` 的 `claim_url`（含 token，勿写入 GitHub / README / 公开仓库）
- 旧链接（v1）：https://subdued-jersey-w7n6d.ship.place/ （仍可能可开，但不是本轮产物）

## 本地路径（Grok Bot 机器）

| 项 | 路径 |
|---|---|
| 源码 | `/workspace/qingtongmen/dsh/` |
| 构建产物 | `/workspace/qingtongmen/dsh/dist/` |
| 截图 | `/workspace/qingtongmen/dsh/shots/`（13 张 + stats.json + console.json） |
| 自审 | `REVIEW.md`（含 v3 节） |
| 需求 | `/workspace/qingtongmen/BRIEF.md` |
| 部署包 | `qingtongmen-ship-v3.zip` |
| 部署响应（含认领 token） | `ship-response.json` |

## 独立验收（2026-10-21 14:36 Asia/Shanghai · DONE-v3）

| 验收项 | 结果 | 证据 |
|---|---|---|
| `pnpm build` | 通过 | Vite build 成功；仅 chunk-size 警告；JS ~1.29 MB |
| 控制台 0 error | 通过 | `shots/console.json` total=0，pageErrors=[] |
| 7 节点 + 3A/3B 截图 stats | 通过 | `shots/stats.json` 13/13 PASS；mean 15.3–69.27；max black 0.590；over 全 0 |
| 节点 1 雪埋竖缝 + 暖光 + 30m 标尺 | 通过（风格化） | `shots/node1.png` |
| 节点 2 地热岩缝 | 通过 | `shots/node2.png` |
| 节点 3A/3B 锁链俯视 + 谷底骨毯 + 门纵深 | 通过 | `shots/node3*.png` / `node3-floor.png` |
| 节点 4–7 同套地面骨层 | 通过 | node4–7 与 3 共用 Rift |
| 门 30×60 m / 人皮 / 蓝雾 / 阴兵 / 鬼玺+刀 / 开→入→闭 | 通过 | node4 / node6* |
| 模型 | deepseek-flash（Flash 1017）+ reasoningEffort max | `flash-max.patch.yml` |

## 已知问题 / 取舍

- 崖壁与阴兵仍是程序化低模；近看棱角与真实扫描材质有差距。
- 节点 1 竖缝约 13 m 高（非贯通 30 m 一线天），暖光来自下部地热喉道。
- 60–70 m 外门面主体仍偏平面；厚度主要靠 6 m 门框、门环、门楣浮雕与掠射阴影建立。
- 骨/岩为大量 InstancedMesh 低模，近景可见重复。
- 无头截图使用 SwiftShader，不代表真实 GPU 60fps；已保留 quality 降级。
- JS 单包约 1.29 MB（gzip ~341 KB），Vite chunk-size 提示未拆包。

## 代表截图

- `/workspace/qingtongmen/dsh/shots/node1.png` — 雪谷竖缝暖光 + 30m 标尺
- `/workspace/qingtongmen/dsh/shots/node3-floor.png` — 谷底骨毯 + 门框纵深
- `/workspace/qingtongmen/dsh/shots/node4.png` — 青铜门全景 + 30×60 尺度
- `/workspace/qingtongmen/dsh/shots/node6-enter.png` — 阴兵四人一行入门 + 蓝雾
