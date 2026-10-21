你是本项目唯一的实现者。工作目录：/workspace/qingtongmen/dsh/（只写这里；不要读写 /workspace/qingtongmen/kimi/。Kimi 参考已复制到 dsh/ref-kimi/，只读参考，不要原样抄）。
这是 v3 修订轮，在现有 v2 代码上改，不要整仓重写。原文 /workspace/qingtongmen/SCENE_SOURCE.md。模型由 patch 固定 deepseek-flash + max，不得切 Pro。
每完成一步就向 progress.log 追加一行（格式同前，前缀 v3-），以便中断后续跑。

v2 读图结论（Randy 清单仍未满足）：
1) node1：雪埋竖缝只是一条细暗线，暖光两个小点；崖壁低模平。
2) node3B：骨头只盖近地，没有"几乎盖住岩块"；火山岩只是几块大方块，地面不够极度不平；画面暗、不吓人；背景门像平的亮面板。

必须做到：
(1) 节点1 雪埋竖缝必须一眼可读：更宽更深的竖向裂缝（参考 ref-kimi/crevice.js 的竖缝构图），缝内有可见的暖色光晕从里面透出（点光/emissive/体积感+少量蒸汽），雪堆半掩缝口；崖壁加岩石细节与法线/位移变化（噪声位移、分层岩脊、法线贴图），30m 崖面不能平；保留崖顶雪檐、1.7m 人影、30m 标尺、暴风雪。
(2) 节点3B 谷底：极度不平的黑色火山岩地形（噪声位移地面 + 大量中小碎岩 instanced，不是几块大方块）；骨头在整个可见地面上几乎覆盖岩块（头骨/肋骨/长骨大量 instanced，分布到远处）；更恐怖但仍可读：雾、冷光、照明弹投射阴影；背景青铜门要有厚度、门框纵深和浮雕（不是平亮面板）。
(3) 节点4–7 用同一新地面/骨层，保持一致。
(4) pnpm build；node scripts/shoot.cjs 重拍；console error 0、stats 全 PASS；亲自读图 node1.png、node3-floor.png、node3.png、node4.png 并诚实自审，不达标继续改（至少 2 轮）。
(5) 更新 REVIEW.md（新增 v3 节：改前→改法→截图证据+已知取舍）和 README；不要部署。最后 progress.log 写一行 DONE-v3 + 自查摘要。
