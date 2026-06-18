---
title: "Function Port 与显式 Pin 冲突修正指南"
doc_type: user-guide
status: active
updated: 2026-06-10
source: ai
---

# Function Port 与显式 Pin 冲突修正指南

本文说明一种容易混淆的滑动 APP 填表问题：`handle_xxx:in` 本来就是函数 `handle_xxx` 的入口，但 payload 又把 `handle_xxx:in` 显式声明成普通 `pin.in`，导致旧 runtime 把事件送进普通 pin，而没有触发函数。

结论先行：

- `:in` 是入口，`:out` 是出口，`:logout` 是日志出口。
- 对 `func.js` / `func.python` 来说，`{funcName}:in/out/logout` 是函数自动拥有的三个端口。
- 开发者不需要、也不应该再把这三个函数端口声明成普通 pin。
- 公开业务入口应该用另一个稳定 pin，例如 `todo_request` / `submit_request`，再用 `pin.connect.label` 接到 `{funcName}:in`。

## 1. 修正前后对比

### 修正前：显式声明了函数端口

下面这类 payload 看起来合理，但会制造歧义：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "todo_request", "t": "pin.in", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "handle_todo_event", "t": "func.js", "v": { "code": "..." } },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "handle_todo_event:in", "t": "pin.in", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "handle_todo_event:out", "t": "pin.out", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "handle_todo_event:logout", "t": "pin.logout", "v": null },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "todo_request_wiring",
    "t": "pin.connect.label",
    "v": [{ "from": "todo_request", "to": ["handle_todo_event:in"] }]
  }
]
```

问题点不在 `handle_todo_event:in` 这个名字。这个名字是对的。

问题点在于：同一个 cell 里既有函数 `handle_todo_event`，又有普通 pin `handle_todo_event:in`。旧 runtime 遇到这个同名端口时，可能先匹配到普通 pin，于是只把值写进 pin，没有执行函数。

### 修正后：只声明函数，不声明函数端口 pin

推荐写法是：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "todo_request", "t": "pin.in", "v": null },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "todo_request_wiring",
    "t": "pin.connect.label",
    "v": [{ "from": "todo_request", "to": ["handle_todo_event:in"] }]
  },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "handle_todo_event",
    "t": "func.js",
    "v": {
      "code": "const records = Array.isArray(label && label.v) ? label.v : []; V1N.addLabel('last_action', 'str', 'open_create');"
    }
  }
]
```

这时：

| 名称 | 类型 | 谁拥有 | 用途 |
|---|---|---|---|
| `todo_request` | 普通 `pin.in` | APP 作者显式声明 | 对外接收按钮或宿主事件 |
| `handle_todo_event` | `func.js` | APP 作者显式声明 | 业务处理函数 |
| `handle_todo_event:in` | 函数自动端口 | runtime 根据函数自动拥有 | 触发函数执行 |
| `handle_todo_event:out` | 函数自动端口 | runtime 根据函数自动拥有 | 函数输出 |
| `handle_todo_event:logout` | 函数自动端口 | runtime 根据函数自动拥有 | 函数日志输出 |

## 2. 如何修正源 ZIP

优先修源文件，再重新导入。不要把已导入实例上的临时修补当成长期方案。

处理步骤：

1. 解压 ZIP，找到 `app_payload.json`。
2. 对每个 cell 找出 `t=func.js` 或 `t=func.python` 的 label，例如 `k=handle_todo_event`。
3. 删除同一个 cell 中这些普通 pin label：
   - `handle_todo_event:in`
   - `handle_todo_event:out`
   - `handle_todo_event:logout`
4. 保留业务公开 pin，例如 `todo_request`、`submit_request`、`submit1`。
5. 保留 wiring 中的 `to: ["handle_todo_event:in"]`。这里仍然要写 `:in`，因为它表示函数入口。
6. 重新打包 ZIP 并通过“滑动 APP 导入”安装。

判断是否应该删除的简单规则：

```text
同一 cell 有 k = X 且 t = func.js / func.python
并且同一 cell 又有 k = X:in / X:out / X:logout 且 t = pin.*
=> 删除 X:in / X:out / X:logout 这些普通 pin label
```

不要删除这些 label：

```text
todo_request
submit_request
submit1
filter_change
其他不是函数名派生出来的公开业务 pin
```

## 3. 如何临时修正已导入实例

如果已经导入到了远端，并且暂时不能重启或重新部署，可以只对这个安装后的 APP 实例做临时修正。

推荐顺序：

1. 先导出或记录当前 model id 和关键 labels。
2. 只删除当前安装实例中同一 cell 的函数端口普通 pin：
   - `handle_todo_event:in`
   - `handle_todo_event:out`
   - `handle_todo_event:logout`
3. 重新写一次对应的 `pin.connect.label` wiring，让运行时重建连接图。
4. 立刻验证按钮事件是否触发函数。

注意：

- 这只能用于单个已安装实例的调试或止血。
- 正式修复仍应回到源 ZIP 或 provider bundle。
- 任何修改都必须走正式 `add_label` / `rm_label` 路径，不要直接改存储文件或绕过 ModelTable。

## 4. Runtime 修正方式

Runtime 维护者需要处理两个点：

### 4.1 同名时函数端口优先

当 `pin.connect.label` 的端点是 `handle_todo_event:in` 时，runtime 应先判断同一 cell 是否存在函数 `handle_todo_event`。

如果存在，端点应解释为函数端口：

```text
handle_todo_event:in -> function port
```

而不是普通 pin：

```text
handle_todo_event:in -> self pin
```

这不改变 `:in` 的含义，只是修正了同名冲突时的归属判断。

### 4.2 函数后加载时重建 wiring

导入 payload 时，labels 的应用顺序可能不是“先函数、后 wiring”。如果 wiring 先被解析，函数后面才被注册，runtime 需要在函数 label 生效后重建当前 cell 的 `pin.connect.label` 图。

否则同一份 payload 可能因为 label 顺序不同而表现不同。

## 5. 验证方法

### 5.1 确定性测试

运行：

```bash
node scripts/tests/test_0413_func_endpoint_port_priority_contract.mjs
```

预期输出：

```text
[PASS] function_endpoint_wins_when_matching_pin_label_exists
```

建议同时跑导入和 MQTT 外发相关回归：

```bash
node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs
node scripts/tests/test_0408_todo_board_import_payload_contract.mjs
node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs
```

### 5.2 浏览器验证

对 ToDo 类滑动 APP，至少验证这三步：

| 操作 | 预期 |
|---|---|
| 点击 `新增任务` | 弹窗打开，内部状态进入 ready/create 状态 |
| 点击 `取消` | 弹窗关闭，任务数量不变 |
| 填写后点击 `保存任务` | 任务新增到某一列，弹窗关闭 |

如果前两步通过、第三步失败，说明函数入口问题大概率已经修好，剩余问题通常在远端 response 是否真的返回业务状态更新。

## 6. 常见误解

### 误解 1：`:in` 不是入口了？

不是。`:in` 仍然是入口。

区别是：

```text
handle_todo_event:in
```

应当是函数 `handle_todo_event` 的自动入口，而不是另一个同名普通 `pin.in`。

### 误解 2：能不能显式声明函数端口，方便阅读？

不建议。它会和函数自动端口重名，旧 runtime 下会造成错误解释。即使新 runtime 已修正，也没有必要保留这类重复声明。

### 误解 3：删除 `handle_todo_event:in` 会不会让 wiring 找不到入口？

不会。只要同一个 cell 里存在：

```json
{ "k": "handle_todo_event", "t": "func.js" }
```

runtime 就知道 `handle_todo_event:in` 是这个函数的入口。

### 误解 4：`submit1` 这种带数字的 pin 也要删吗？

不要删。`submit1` 是业务公开出口 pin，不是 `某个函数名:in/out/logout` 形式的自动端口。

只删除“函数名 + 冒号端口”并且同 cell 存在同名函数的重复普通 pin。
