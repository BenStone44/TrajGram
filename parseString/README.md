# `parseString/`

这个目录负责 TrajGram 的样式表达式解析。

它的职责不是渲染，而是把 JSON 里的字符串配置解析成运行时可执行的映射函数，供 `encoding/` 和 `annotation/` 使用。

核心文件：

- [regex.ts](/F:/TrajGram/TrajGram/parseString/regex.ts:1)

## 支持的表达式

### 静态颜色

```ts
"#d9dff1"
"red"
```

### 静态数值

```ts
3
0.8
20
```

### 点级渐变 `gradient(...)`

按点属性 `$P.xxx` 做颜色或数值映射。

```ts
"gradient($P.speed, [#b35a00, #d6d632])"
"gradient($P.speed, [30, 50], [#b35a00, #d6d632])"
"gradient($P.speed, [0, 10, 20], [2, 6, 12])"
```

属性来源：

- `$P.speed` 会读取 `point.attributes.others.speed`

### 轨迹级线性映射 `linear(...)`

按轨迹属性或轨迹统计值做颜色或数值映射。

```ts
"linear(speed($T), [#2c7bb6, #ffffbf, #d7191c])"
"linear(speed($T), [0, 5, 12], [0, 35, 40])"
"linear(distance($T), [0, 5, 10], [2, 6, 10])"
"linear($T.someAttr, [0, 1], [0.2, 1.0])"
```

已支持的轨迹内置函数：

- `speed($T)`
- `distance($T)`
- `time($T)`

属性来源：

- `$T.someAttr` 会读取 `trajectory.attributes.someAttr`

## 对外入口

最常用的入口是：

- `parseColorString(...)`
- `parseNumberString(...)`

它们会把 JSON 配置值解析成统一结构：

```ts
{ type: 'static' | 'gradient' | 'linear', value: ... }
```

上层模块再根据 `type` 决定是直接使用静态值，还是在渲染阶段执行映射函数。

## 调用位置

当前主要被以下模块使用：

- [encoding/encoding.ts](/F:/TrajGram/TrajGram/encoding/encoding.ts:1)
- [encoding/annotation.ts](/F:/TrajGram/TrajGram/encoding/annotation.ts:1)

## 当前限制

- `gradient(...)` 当前只支持 `$P.xxx`。
- `linear(...)` 当前主要面向 `$T.xxx` 和轨迹内置函数。
- 文本内容本身还没有完整接入这套表达式系统；目前主要用于颜色、宽度、半径、透明度等样式字段。
