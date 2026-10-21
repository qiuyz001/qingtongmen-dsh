# 长白山青铜门 · DSH 版

《盗墓笔记》长白山青铜门场景的交互式 three.js 3D 网页。按原文日线还原雪谷、岩缝温泉、地下裂谷、青铜门、门纹特写、阴兵借道、尾声「十年」共 7 个节点。

## 在线预览

- 地址：https://subdued-jersey-w7n6d.ship.place/
- 预计到期：约 2026-11-19（北京时间）
- 到期后可从本仓库 `dist/` 本地预览，或重新 `pnpm build` 后自行部署。

## 模型与制作

- 模型：DeepSeek **Flash 1017**（思考档最高）
- 技术：three.js + Vite（pnpm），程序化几何与 shader，不导入外部模型
- 复用库：见 [docs/REUSE.md](docs/REUSE.md)

## 本地运行

需要 Node.js 与 pnpm。

```bash
pnpm i
pnpm build
pnpm preview
```

开发模式：

```bash
pnpm dev
```

截图验收（可选，需本机环境）：

```bash
pnpm shoot
```

## 节点一览

1. 雪谷入口  
2. 岩缝温泉  
3. 地下裂谷（鼠标手电，按 `F` 照明弹）  
4. 青铜门全景  
5. 门纹特写（可旋转观察；纹样标「推演」）  
6. 阴兵借道（约 40–60 秒，可重播）  
7. 尾声「十年」

## 需求与史料

本仓库 `docs/` 目录为任务共用文档副本：

| 文件 | 说明 |
|------|------|
| [docs/BRIEF.md](docs/BRIEF.md) | 完整需求（节点、交互、验收） |
| [docs/SCENE_SOURCE.md](docs/SCENE_SOURCE.md) | 原文出处与场景要素 |
| [docs/PLAN.md](docs/PLAN.md) | 项目规划与工期 |
| [docs/REUSE.md](docs/REUSE.md) | 可复用库清单 |

制作过程记录见 `DELIVERY.md`、`REVIEW.md`；节点截图在 `shots/`。

## 许可与版权

场景依据南派三叔《盗墓笔记》小说描写做可视化还原；门纹具体图样原文未写，界面已标「推演」。本仓库代码仅供个人学习与对比，请勿用于商业用途。
