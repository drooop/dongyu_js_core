---
title: "PIN Connection Contract v2"
doc_type: ssot
status: active
updated: 2026-05-06
source: user
iteration: 0356-pin-connection-contract-realignment
---

# PIN Connection Contract v2

本文件冻结 0356 后的目标引脚合同。它覆盖早期文档中把跨模型路由声明为 `pin.connect.model`、把同 Cell 端点写成 `(self, pin)` / `(func, func:in)` 的写法。

0356 是 docs-only 规约收口：当前 runtime、测试资产和部分历史示例仍可能包含旧写法。旧写法只能作为迁移债务出现，不得作为新模型、新文档或新测试的输入面。

---

## 1. Cell 引脚类型

普通 Cell 可声明四类引脚：

| label.t | 含义 | 连接对象 |
|---|---|---|
| `pin.in` | 普通数据输入 | 只能与 `pin.out` 互连 |
| `pin.out` | 普通数据输出 | 只能与 `pin.in` 互连 |
| `pin.login` | 日志数据输入 | 只能与 `pin.logout` 互连 |
| `pin.logout` | 日志数据输出 | 只能与 `pin.login` 互连 |

规则：

- 数据通道与日志通道不可混连。
- `pin.in` / `pin.out` 传普通模型数据。
- `pin.login` / `pin.logout` 传日志模型数据。
- 早期 `pin.log.in` / `pin.log.out` / `pin.log.bus.*` 不是 0356 后的新规约名称，只能作为迁移债务处理。
- `pin.bus.in` / `pin.bus.out` 是 Model 0 的系统边界 adapter，不是普通 Cell 的第五类引脚；它们进入普通模型层后必须转换为本合同中的 Cell 引脚路由。

---

## 2. 函数引脚

每个函数固定有三个函数引脚：

| 函数引脚 key | 作用 |
|---|---|
| `{functionName}:in` | 接收模型数据并触发函数执行 |
| `{functionName}:out` | 输出函数执行结果 |
| `{functionName}:logout` | 输出函数执行日志 |

函数引脚不是跨 Cell 端点。函数引脚只能通过函数所在 Cell 的 `pin.connect.label` 连接到同 Cell 的普通引脚。

禁止：

- 在 `pin.connect.cell` 中直接引用 `{functionName}:in`、`{functionName}:out` 或 `{functionName}:logout`。
- 让函数引脚直接连接到其他 Cell。
- 在新模型中使用 `{functionName}:log.out`。

---

## 3. 连接声明类型

0356 后只保留两类连接声明：

| label.t | 作用 | 允许位置 |
|---|---|---|
| `pin.connect.label` | 同一个 Cell 内多个引脚之间的连接 | 任意 Cell |
| `pin.connect.cell` | 同一个模型内多个 Cell 的引脚之间的连接 | 当前模型 root `(0,0,0)` |

`pin.connect.model` 已从目标合同中移除。跨模型通信必须通过 `model.submt` hosting Cell 暴露出来的父模型内 Cell 引脚、子模型 root `(0,0,0)` 的边界引脚，以及父模型内的 `pin.connect.cell` 完成，不再存在单独的跨模型连接 label.t。

---

## 4. `pin.connect.label`

`pin.connect.label` 只描述同一个 Cell 内的接线。端点直接使用引脚名称，不使用 `(prefix, pinName)` 字符串。

示例：

```json
[
  {
    "from": "in1",
    "to": ["func1:in", "func2:in"]
  }
]
```

含义：

- 当前 Cell 的 `in1` 收到模型数据后，转发给当前 Cell 内 `func1:in` 与 `func2:in`。
- 如果 `to` 指向函数 `:in`，对应函数被触发。
- 如果函数返回结果，可继续由同 Cell 的函数 `:out` 接到该 Cell 的 `pin.out`。

合法端点：

- 当前 Cell 上声明的 `pin.in` / `pin.out` / `pin.login` / `pin.logout` 的 key。
- 当前 Cell 上函数自动拥有的 `{functionName}:in` / `{functionName}:out` / `{functionName}:logout`。

非法端点：

- `(self, x)`、`(func, f:in)`、`(123, x)` 等早期 prefix 写法。
- 其他 Cell 的坐标。
- 其他模型的 id。

---

## 5. `pin.connect.cell`

`pin.connect.cell` 只描述同一个模型内多个 Cell 的引脚连接。端点格式为：

```json
[p, r, c, "pinName"]
```

示例：

```json
[
  {
    "from": [0, 0, 0, "in1"],
    "to": [[1, 0, 0, "in2"]]
  },
  {
    "from": [1, 0, 0, "out1"],
    "to": [[1, 0, 1, "in1"], [2, 0, 0, "in2"]]
  }
]
```

含义：

- 当前模型中 `(0,0,0)` Cell 的 `in1` 连接到 `(1,0,0)` Cell 的 `in2`。
- 当前模型中 `(1,0,0)` Cell 的 `out1` 连接到 `(1,0,1)` Cell 的 `in1` 和 `(2,0,0)` Cell 的 `in2`。

约束：

- `from` 与 `to` 都必须指向同一个模型内的 Cell。
- 端点的 `"pinName"` 必须是目标 Cell 上声明的 Cell 引脚 key，不能是函数引脚。
- 函数触发必须先路由到函数所在 Cell 的普通引脚，再由该 Cell 的 `pin.connect.label` 接到函数引脚。

---

## 6. 子模型边界

子模型内的普通 Cell 只能连接到同一个子模型内的其他 Cell。

子模型对外只允许通过子模型 root `(0,0,0)` 的引脚：

- 子模型内部 Cell → 子模型 root `(0,0,0)` 引脚。
- 子模型 root `(0,0,0)` 引脚 → 父模型 hosting Cell 上由 `model.submt` 暴露的引脚。
- 父模型再使用父模型自己的 `pin.connect.cell` 把 hosting Cell 接到父模型内其他 Cell。

禁止：

- 子模型非 root Cell 直接连接到父模型 Cell。
- 父模型通过 `pin.connect.model` 直接按 model id 连到子模型。
- 在连接端点中写 `[modelId, "pinName"]`。

---

## 7. 引脚传递内容

所有引脚传递的内容都是模型数据，格式为 ModelTable-like record array。例如：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Code.Python" },
  { "id": 0, "p": 1, "r": 0, "c": 0, "k": "model_type", "t": "model.submt", "v": 1 },
  { "id": 1, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Data.Array" }
]
```

传输中的模型数据默认是临时数据：`format is ModelTable-like, persistence is explicit materialization`。只有接收方明确执行 materialization 时，才会变成正式持久模型表数据。

当模型数据传递到函数的 `{functionName}:in` 时，运行时应把传入记录数组构造成临时模型对象 `input_model`，并与函数所在模型对象 `model` 一起传入函数。函数只能通过受控 API 产生正式副作用。

---

## 8. 0356 迁移边界

0356 只冻结目标合同并标记矛盾点，不直接修改 runtime。

后续 implementation iteration 必须处理：

- runtime 中 `pin.connect.model` 的解析、存储和分发。
- runtime 中 `(self, ...)` / `(func, ...)` / numeric prefix 的 `pin.connect.label` 解析。
- runtime 和系统模型中的 `{functionName}:log.out`。
- 当前 `pin.log.*` 日志引脚命名。
- 文档、测试和模型资产中的旧示例。
