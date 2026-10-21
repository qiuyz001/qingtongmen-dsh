# 青铜门 three.js 复用清单（2026-10-20 gh/npm 实查）
基线：three@0.186.1（npm 最新）。postprocessing 6.39.5 要求 three >=0.168 <0.187，所以要锁 0.186.x。全部为 WebGL2，不强制 WebGPU。

| # | 项目 | ★ | 最近推送 | 许可 | npm (版本) | 用于节点 |
|---|---|---|---|---|---|---|
|1|[mrdoob/three.js](https://github.com/mrdoob/three.js) addons：MarchingCubes、SimplexNoise、ImprovedNoise、InstancedMesh、SpotLight、Sky、FogExp2|116650|2026-10-20|MIT|three 0.186.1|全部：裂谷/洞壁（noise 位移、marching cubes）、阴兵 instancing、手电 SpotLight|
|2|[pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)：Bloom、GodRays、DepthOfField、Vignette、Noise、ToneMapping|2887|2026-10-05|Zlib（宽松）|postprocessing 6.39.5|门缝蓝雾辉光、照明弹 bloom、雪谷 god rays、全局胶片感|
|3|[FarazzShaikh/THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)|1347|2025-10-12|MIT|three-custom-shader-material 6.4.0|在 MeshStandard/Physical 上叠青铜铜绿 noise、人皮冻血、岩壁湿润 shader（保留 PBR 光照）|
|4|[Alchemist0823/three.quarks](https://github.com/Alchemist0823/three.quarks)|1081|2026-05-21|MIT|three.quarks 0.17.1（peer three>=0.182）|暴风雪、温泉蒸汽、照明弹火花/烟、门缝淡蓝雾|
|5|[yomotsu/camera-controls](https://github.com/yomotsu/camera-controls)|2438|2026-10-12|MIT|camera-controls 3.1.2|7 个节点间的平滑镜头过渡（setLookAt 带过渡）|
|6|[theatre-js/theatre](https://github.com/theatre-js/theatre)|12781|2024-08-14（停更）|Apache-2.0|@theatre/core 0.7.2（+@theatre/studio 仅开发用）|阴兵借道 40–60s 关键帧时间线（可选，停更有风险）|
|7|[greensock/GSAP](https://github.com/greensock/GSAP)|29512|2026-04-13|自有 "Standard No-Charge" 许可，免费可商用但不是 MIT|gsap 3.15.0|ScrollTrigger 滚动叙事、卡片淡入；若严格只用 MIT 就去掉，改用 camera-controls+Theatre|
|8|[Tonejs/Tone.js](https://github.com/Tonejs/Tone.js)|14785|2026-10-17|MIT|tone 15.1.22|鹿角号（锯齿波+滤波+混响）、风雪噪声、低频轰鸣、门开裂响|
|9|[jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js)|1850|2024-07-26|MIT|simplex-noise 4.0.3|CPU 端地形/岩壁位移、雪谷高度场、阴兵步态抖动|
|10|[pmndrs/three-stdlib](https://github.com/pmndrs/three-stdlib)|863|2026-06-26|MIT|three-stdlib|可选：addons 的 TS 版（直接用 three/addons 也行）|
|11|[0beqz/realism-effects](https://github.com/0beqz/realism-effects)|1737|2024-02-04|MIT|realism-effects|可选 SSGI/AO 增强青铜质感；停更、性能重，swiftshader 下慎用，只作参考|
|12|[hsimpson/threejs-volumetric-spotlight](https://github.com/hsimpson/threejs-volumetric-spotlight)|4|2024-03-05|MIT|无（抄 shader）|手电光锥体积感参考实现（体量小，只借鉴代码）|

## 没找到 / 自己写
- 体积雾：gh 搜 "threejs volumetric" 只有个位数星的 demo，没有成熟的 npm 库。做法：雾用 FogExp2 + 半透明噪声平面叠层 + postprocessing GodRays，或者照 three 官方 webgl_volume_cloud 示例写 raymarch。
- 商周纹样（云雷纹/饕餮纹）：gh 搜 "taotie" 出来的全是同名的无关仓库，没找到开放许可的 SVG 或网格。建议用代码生成（云雷纹就是方形回旋螺线，饕餮做成对称图案），烘成 CanvasTexture，再当 normal/bump map 用。不要用影视剧素材。
- 洞穴/遗迹叙事开源项目：gh 搜 "threejs cave"、"three.js museum scroll" 基本是空的，Invisible Cities 本身也没开源仓库。上次找到的 threejs-skills 和 Threejs-Awesome-Graphics-Agent-Skills 仍然是主要参考。
- 程序化人形：没有合适的库，用 Capsule/Box 拼 + InstancedMesh + 顶点 shader 做步态。

## 推荐组合
three（锁 0.186.x）+ postprocessing + three-custom-shader-material + three.quarks + camera-controls + tone + simplex-noise。时间线用 camera-controls 加自写 tween，或用 gsap（许可不是 MIT 但免费），Theatre 可选。

```
pnpm add three@~0.186.1 postprocessing@^6.39.5 three-custom-shader-material@^6.4.0 three.quarks@^0.17.1 camera-controls@^3.1.2 tone@^15.1.22 simplex-noise@^4.0.3 && pnpm add -D @types/three@~0.186.0
```
