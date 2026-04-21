# TrajGram (Trajectoolkit)

Trajectoolkit 是一个面向轨迹可视分析的前端库，基于 Mapbox GL + WebGL2 + SVG，支持以声明式 JSON 配置完成轨迹渲染、筛选、分段、聚合与标注。

## 特性

- Mapbox `IControl` 组件化接入，直接叠加到地图上。
- 多渲染层支持：`trajectories`、`points`、`markers`、`text`。
- 声明式数据流：`Data -> Selection -> Query -> Encoding`。
- 支持交互选择：`lens.start` / `lens.end` / `lens.pass` / `mouse.hover` / `mouse.click`。
- 支持查询类型：`filter`、`segmentation`、`aggregation`。
- 支持样式表达式：静态值、`gradient(...)`、`linear(...)`。
- 可选后端协同（通过 `baseUrl`）：配置同步、选择几何体回传、按 ID 请求数据。

## 目录结构

- `Trajectoolkit.ts`：主入口类（Mapbox 控件）。
- `data-management/`：数据节点与更新传播。
- `selection/`：交互选择（镜头、鼠标等）。
- `query/`：过滤、分段、聚合查询。
- `encoding/`：轨迹样式与标注映射。
- `render-manager/`：WebGL/SVG 渲染组。
- `interfaces/`：轨迹与路网数据结构定义。
- `parseString/`：样式字符串解析器。

## 依赖

建议在宿主前端项目中安装：

```bash
npm install mapbox-gl d3 color
```

## 快速开始

```ts
import mapboxgl from 'mapbox-gl';
import { Trajectoolkit } from './Trajectoolkit';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [120.16, 30.28],
  zoom: 12,
  accessToken: '<YOUR_MAPBOX_TOKEN>'
});

map.on('load', async () => {
  // 传 baseUrl 则启用后端协同；不传则使用前端本地数据 URL 拉取
  const tkt = new Trajectoolkit('http://localhost:3000');
  map.addControl(tkt);

  await tkt.jsonParser(spec);
});
```

## JSON 配置示例

```json
{
  "data": [
    {
      "id": "trajectory_data",
      "type": "trajectory",
      "url": "/data/single_trajectory.json"
    },
    {
      "id": "roadnetwork",
      "type": "roadnetwork",
      "url": "/data/roadnetwork.json"
    }
  ],
  "selections": {
    "lens_pass_1": "lens.pass"
  },
  "queries": [
    {
      "id": "q_filter_1",
      "source": "trajectory_data",
      "type": "filter",
      "condition": ["distance($T)>1000"]
    },
    {
      "id": "q_seg_1",
      "source": "q_filter_1",
      "type": "segmentation",
      "operator": "evenD(5)"
    }
  ],
  "encodings": [
    {
      "id": "e_main",
      "type": "trajectory",
      "source": "q_seg_1",
      "styles": {
        "color": "linear(speed($T), [#2c7bb6, #ffffbf, #d7191c])",
        "width": 3,
        "opacity": 0.9
      },
      "annotations": {
        "a_points": {
          "source": "all",
          "type": "points",
          "styles": {
            "r": 2.5,
            "color": "#222222",
            "opacity": 0.8
          }
        }
      }
    }
  ]
}
```

## 主要 API

- `new Trajectoolkit(baseUrl?)`
- `jsonParser(config)`：解析并构建 Data/Selection/Query/Encoding 图。
- `getDQSDatabyID(id)`：按节点 ID 获取当前数据结果。
- `addDataByProps(...)` / `addSelectionByJson(...)` / `addQueryByJson(...)` / `addEncodingByJson(...)`
- `addEventLisener(id, 'update', name, cb)`：监听节点更新。
- `clearAll()`：清空渲染与数据状态。

## 已知说明

- 该仓库当前以源码形态提供（尚未发布 npm 包）。
- 渲染依赖浏览器 `WebGL2` 能力。
- 使用 `baseUrl` 时，默认会向后端调用：
  - `PUT /api/config`
  - `PUT /api/selection/{id}/geo-element`
  - `GET /api/dqs/{id}/data`
