# TrajGram JSON Syntax Guide

本文档说明 `Trajectoolkit.jsonParser(...)` 所接收的 JSON 配置语法。内容按组件拆分，优先描述当前代码里已经实现并可直接使用的部分。

## 1. Top-Level Structure

完整配置通常包含这些顶层字段：

```json
{
  "map": {
    "center": [120.18, 30.27],
    "zoom": 13
  },
  "data": [],
  "selections": {},
  "queries": [],
  "encodings": []
}
```

说明：

- `map`：地图初始视角信息。
- `data`：数据源定义。
- `selections`：交互选择器定义。
- `queries`：查询节点定义。
- `encodings`：可视编码定义。

ID 引用规则：

- `source`、`condition` 等字段里使用的是逻辑 ID，例如 `trajectory_data`、`Q1`、`startLens`。
- 不需要写内部前缀 `d_`、`q_`、`s_`、`e_`。这些前缀由库内部自动管理。

## 2. `map`

语法：

```json
{
  "map": {
    "center": [lng, lat],
    "zoom": 13
  }
}
```

字段说明：

- `center`: `[number, number]`，顺序是 `[lng, lat]`。
- `zoom`: `number`。

注意：

- 当前 `jsonParser(...)` 本身不会消费 `map` 字段。
- `map` 更像是给宿主应用保存初始视角的元信息，通常应由外部代码手动读出并传给 Mapbox。

## 3. `data`

语法：

```json
{
  "data": [
    {
      "id": "trajectory_data",
      "type": "trajectory",
      "url": "./src/data/sample.json"
    }
  ]
}
```

字段说明：

- `id`: 数据节点 ID，后续 `queries` 和 `encodings` 会引用它。
- `type`: 当前支持：
  - `trajectory`
  - `roadnetwork`
  - `geojson`
- `url`: 本地或远程 JSON 地址。

行为说明：

- 不传 `baseUrl` 时，库会直接 `fetch(url)` 拉取数据。
- 传了 `baseUrl` 时，`data` 节点仍然要声明，但本地 `url` 不会被直接拉取；配置会同步到后端，由后端返回数据。

建议：

- 如果要使用 `aggregation`，路网数据建议使用固定 ID：`roadnetwork`。当前实现里聚合逻辑会直接查这个名字。

## 4. `selections`

语法：

```json
{
  "selections": {
    "startLens": "lens.start",
    "endLens": "lens.end",
    "passLens": "lens.pass",
    "hoverTraj": "mouse.hover",
    "clickTraj": "mouse.click"
  }
}
```

当前 JSON 里支持的选择器类型：

- `lens.start`
- `lens.end`
- `lens.pass`
- `mouse.hover`
- `mouse.click`

说明：

- `lens.start`：筛选起点落入镜头区域的轨迹。
- `lens.end`：筛选终点落入镜头区域的轨迹。
- `lens.pass`：筛选经过镜头区域的轨迹。
- `mouse.hover`：鼠标悬停选择。
- `mouse.click`：鼠标点击选择。

当前实现限制：

- `jsonParser(...)` 目前只支持最简写法：`"selectionId": "selection.type"`。
- `SelectionProps` 虽然在代码层面支持 `style`、`trigger` 等字段，但当前 JSON 解析器不会读取它们。
- 也就是说，lens 的 `center / r / fill / stroke / strokeWidth` 目前不能直接在 JSON 里内联配置；如需设置，需要扩展解析器或走代码 API。

## 5. `queries`

语法：

```json
{
  "queries": [
    {
      "id": "Q1",
      "source": "trajectory_data",
      "type": "filter",
      "condition": ["startLens", "distance($T)>1000"]
    }
  ]
}
```

公共字段：

- `id`: 查询节点 ID。
- `source`: 上游数据源 ID，可以引用 `data` 或前一个 `query`。
- `type`: 当前支持：
  - `filter`
  - `segmentation`
  - `aggregation`

### 5.1 `filter`

语法：

```json
{
  "id": "Q_filter",
  "source": "trajectory_data",
  "type": "filter",
  "condition": ["startLens", "endLens", "distance($T)>1000"]
}
```

规则：

- `condition` 应写成数组。
- 数组内多个条件是逻辑与关系。
- 每个条件可以是：
  - 一个 selection ID，例如 `startLens`
  - 一个内置条件表达式字符串

已实现的内置条件：

- 距离比较

```text
distance($T) > 1000
distance($T) >= 1000
distance($T) < 1000
distance($T) <= 1000
distance($T) == 1000
```

- 时间类别

```text
weekday
weekend
morning
afternoon
```

- 时间区间

```text
[2024-01-01,2024-02-01]
```

说明：

- `weekday`/`weekend`/`morning`/`afternoon` 都基于轨迹第一个点的时间字段。
- 时间区间字符串会被当作 `[start, end)` 区间处理。

注意：

- 当前实现中，如果 `condition` 写成单个字符串而不是数组，解析结果会退化为“无条件过滤”。建议始终使用数组。

### 5.2 `segmentation`

语法：

```json
{
  "id": "Q_seg",
  "source": "trajectory_data",
  "type": "segmentation",
  "operator": "evenD(5)"
}
```

当前支持的 `operator`：

- `evenD(n)`：按距离等分为 `n` 段。
- `evenT(n)`：按时间等分为 `n` 段。
- `road`：按点上的 `source.sid` 路段 ID 切分。

示例：

```json
{ "operator": "evenD(5)" }
{ "operator": "evenT(8)" }
{ "operator": "road" }
```

说明：

- `evenD(n)` 和 `evenT(n)` 返回子轨迹集合。
- `road` 依赖每个轨迹点的 `attributes.source.sid`。
- `road` 切分后，子轨迹会带上 `attributes.road_id`、`attributes.distance`、`attributes.durtime`，供后续聚合使用。

注意：

- `set` 字段虽然在类型定义里存在，但当前查询执行逻辑没有实际使用它。

### 5.3 `aggregation`

语法：

```json
{
  "id": "Q_agg",
  "source": "Q_seg_road",
  "type": "aggregation"
}
```

用途：

- 把按路段切分后的轨迹结果聚合回路网，生成带 `volume`、`speed` 等属性的路网结果。

前置条件：

- `source` 最好来自 `operator: "road"` 的分段结果。
- 项目里应存在一个路网数据节点，并且 ID 为 `roadnetwork`。

## 6. `encodings`

语法：

```json
{
  "encodings": [
    {
      "id": "main",
      "type": "trajectories",
      "source": "Q1",
      "styles": {
        "color": "#81602e",
        "width": 8,
        "opacity": 0.9
      },
      "zIndex": 2,
      "maxzoom": 18,
      "minzoom": 10,
      "capstyle": "round",
      "annotations": {}
    }
  ]
}
```

字段说明：

- `id`: 编码节点 ID。
- `type`: 约定上写 `trajectories`。当前实现里该字段不会切换不同渲染器，轨迹编码统一走 trajectory renderer。
- `source`: 上游数据节点或查询节点 ID。
- `styles`: 主轨迹样式。
- `zIndex`: 图层顺序，数字越大越靠上。
- `maxzoom` / `minzoom`: 可见缩放范围。
- `capstyle`: 线端点样式，可选：
  - `round`
  - `square`
- `annotations`: 标注配置对象。

`styles` 当前支持：

- `color`
- `width`
- `opacity`

每个样式值都可以是：

- 静态值
- 表达式字符串

注意：

- `annotations` 在当前实现里应始终提供；如果没有标注，建议写成空对象 `{}`。

## 7. `annotations`

语法：

```json
{
  "annotations": {
    "startpoints": {
      "source": "$T.distance[0]",
      "type": "points",
      "styles": {
        "color": "#357336",
        "r": 20,
        "opacity": 1
      }
    }
  }
}
```

一个 annotation 由这些字段组成：

- `source`: 从每条轨迹上取哪些位置。
- `type`: 标注类型。
- `styles`: 标注样式。
- `maxzoom` / `minzoom`: 可选缩放范围。

### 7.1 `source` 位置表达式

当前支持的轨迹取点语法：

- 起点 / 终点

```text
$T.distance[0]
$T.distance[1]
$T.time[0]
$T.time[1]
```

- 按比例取点

```text
$T.distance[0.25]
$T.distance[0.25,0.5,0.75]
$T.time[0.5]
```

- 按数量均匀取点

```text
$T.distance(6)
$T.time(6)
```

解释：

- `distance[...]`：按路程比例取点。
- `time[...]`：按时间比例取点。
- `[0]` 和 `[1]` 会被特殊处理为轨迹首尾原始点。
- `(6)` 表示在整条轨迹上均匀生成 6 个点。

补充：

- 文本标注如果设置了 `follow: true`，库会给取出的点补充方向信息，用于沿轨迹旋转文本。

当前实现限制：

- `arrows` 虽然在类型里声明过，但当前没有完整渲染实现，JSON 中不要使用。
- `$T.distance($n)` 这种变量数量语法只在底层解析器里预留了接口，当前 `jsonParser(...)` 流程不会给它传变量。

### 7.2 `type`

当前可用类型：

- `points`
- `markers`
- `text`

### 7.3 `points` 样式

语法：

```json
{
  "type": "points",
  "styles": {
    "color": "#000000",
    "r": 6,
    "opacity": 0.8
  }
}
```

支持字段：

- `color`
- `r`
- `opacity`

### 7.4 `markers` 样式

语法：

```json
{
  "type": "markers",
  "styles": {
    "color": "#0059b3",
    "size": 20,
    "opacity": 1
  }
}
```

支持字段：

- `color`
- `size`
- `opacity`

注意：

- 当前实现读取的是 `size`，不是 `r`。
- 如果在 JSON 里给 `markers` 写 `r`，当前代码不会按预期生效。

### 7.5 `text` 样式

语法：

```json
{
  "type": "text",
  "styles": {
    "color": "#533d26",
    "opacity": 1,
    "text": "label",
    "font_size": 20,
    "transform": "translate(10, 0)",
    "follow": true
  }
}
```

支持字段：

- `color`
- `opacity`
- `text`
- `font_size`
- `transform`
- `follow`

说明：

- `follow: true` 时，文本会根据轨迹方向旋转。
- `transform` 是附加在 SVG 文本上的变换字符串。

注意：

- 当前实现读取的是 `font_size`，不是 `size`。
- `text` 当前按常量字符串处理，不会在 JSON 中解析 `$P.time`、`time($T)` 之类表达式。

## 8. Style Expression Syntax

轨迹主样式和标注样式里的数值/颜色字段支持表达式字符串。

### 8.1 静态值

颜色：

```text
#d9dff1
red
```

数值：

```text
3
0.8
20
```

### 8.2 `gradient(...)`

用途：

- 基于点属性 `$P.xxx` 做渐变映射。

语法：

```text
gradient($P.speed, [#b35a00, #d6d632])
gradient($P.speed, [30, 50], [#b35a00, #d6d632])
gradient($P.speed, [0, 10, 20], [2, 6, 12])
```

说明：

- 第一种写法使用默认输入区间。
- 第二种写法显式给出输入区间和输出颜色列表。
- 第三种写法显式给出输入区间和输出数值列表。

限制：

- `gradient(...)` 当前只解析 `$P.xxx`。
- `$P.xxx` 读取的是 `point.attributes.others.xxx`。

### 8.3 `linear(...)`

用途：

- 基于轨迹属性 `$T.xxx` 或内置轨迹函数做线性映射。

语法：

```text
linear(speed($T), [#2c7bb6, #ffffbf, #d7191c])
linear(speed($T), [0, 5, 12], [0, 35, 40])
linear(distance($T), [0, 5, 10], [2, 6, 10])
linear($T.someAttr, [0, 1], [0.2, 1.0])
```

已实现的轨迹属性来源：

- `speed($T)`：平均速度，等于 `distance / duration`
- `distance($T)`：轨迹距离
- `time($T)`：轨迹持续时间，单位秒
- `$T.someAttr`：读取 `trajectory.attributes.someAttr`

## 9. Data Shape Expectations

### 9.1 `trajectory`

轨迹数据至少应满足这类结构：

```json
{
  "id": "T1",
  "starttime": "2024-01-01T08:00:00Z",
  "endtime": "2024-01-01T08:10:00Z",
  "distance": 5.2,
  "shapingPoints": [
    {
      "id": "P1",
      "basePoint": {
        "time": "2024-01-01T08:00:00Z",
        "position": {
          "lng": 120.18,
          "lat": 30.27
        }
      },
      "attributes": {
        "source": {
          "sid": "road_1"
        },
        "others": {
          "speed": 32
        }
      }
    }
  ],
  "attributes": {}
}
```

关键点：

- `distance`、`starttime`、`endtime` 会被查询和样式表达式使用。
- `shapingPoints[*].basePoint.position` 是必需的。
- 如果要用 `gradient($P.xxx)`，点属性应放在 `shapingPoints[*].attributes.others.xxx`。
- 如果要用 `segmentation` 的 `road` 模式，点属性里需要 `attributes.source.sid`。

### 9.2 `roadnetwork`

聚合场景下，单条路网记录通常应包含：

```json
{
  "id": "road_1",
  "distance": 0.42,
  "shapingPoints": []
}
```

## 10. Minimal Examples

### 10.1 Lens Filter Comparison

```json
{
  "data": [
    {
      "id": "trajectory_data",
      "type": "trajectory",
      "url": "./src/data/xihu_dongzhan.json"
    }
  ],
  "selections": {
    "startLens": "lens.start",
    "endLens": "lens.end",
    "passLens": "lens.pass"
  },
  "queries": [
    {
      "id": "Q1",
      "source": "trajectory_data",
      "type": "filter",
      "condition": ["startLens", "endLens", "passLens"]
    }
  ],
  "encodings": [
    {
      "id": "main",
      "type": "trajectories",
      "source": "Q1",
      "styles": {
        "color": "#81602e",
        "width": 10,
        "opacity": 1
      },
      "annotations": {}
    }
  ]
}
```

### 10.2 Even Segmentation

```json
{
  "data": [
    {
      "id": "trajectory_data",
      "type": "trajectory",
      "url": "./src/data/single_trajectory.json"
    }
  ],
  "selections": {},
  "queries": [
    {
      "id": "segmentation",
      "source": "trajectory_data",
      "type": "segmentation",
      "operator": "evenD(5)"
    }
  ],
  "encodings": [
    {
      "id": "segments",
      "type": "trajectories",
      "source": "segmentation",
      "styles": {
        "color": "#cfb395",
        "width": "linear(speed($T), [0, 5, 12], [0, 35, 40])"
      },
      "annotations": {}
    }
  ]
}
```

## 11. Current Implementation Notes

当前代码和 JSON 语法之间有几处需要特别注意：

- `map` 字段目前只是元信息，不由 `jsonParser(...)` 自动应用。
- `selections` 当前只支持字符串写法，不支持在 JSON 中直接传 lens 样式对象。
- `queries[].condition` 建议始终写数组。
- `queries[].set` 当前未生效。
- `encodings[].type` 当前主要是语义字段，不负责切换不同编码器。
- `annotations[].type = "arrows"` 目前不要使用。
- `markers.styles` 使用 `size`，不要写 `r`。
- `text.styles` 使用 `font_size`，不要写 `size`。
- `text.styles.text` 当前只支持常量字符串，不支持 JSON 内联表达式求值。
