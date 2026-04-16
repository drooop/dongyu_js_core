---
title: "0320 — imported-slide-app-host-ingress-semantics-freeze Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-14
source: ai
iteration_id: 0320-imported-slide-app-host-ingress-semantics-freeze
id: 0320-imported-slide-app-host-ingress-semantics-freeze
phase: phase4
---

# 0320 — imported-slide-app-host-ingress-semantics-freeze Resolution

## Execution Strategy

1. 先收当前事实证据，确认现有 direct-pin、deferred input 和 scope discoverability 的正式边界。
2. 再冻结候选宿主 ingress 语义，明确它不是当前事实，而是下一阶段规约候选。
3. 最后评估对现有说明页和未来实现迭代的影响，但不进入实现。

## Step 1

- Scope:
  - 收当前已实现事实
- Files:
  - `docs/iterations/0305-slide-event-target-and-deferred-input-sync/resolution.md`
  - `docs/iterations/0306-slide-pin-chain-routing-buildout/resolution.md`
  - `docs/iterations/0310-slide-frontend-pin-addressing-freeze/resolution.md`
  - `docs/iterations/0311-slide-page-asset-pinification-buildout/resolution.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- Verification:
  - 记录关键事实和不变量
- Acceptance:
  - “当前事实”部分自洽，不混入候选架构
- Rollback:
  - 回退 `0320` 文档

## Step 2

- Scope:
  - 冻结候选宿主 ingress 语义
- Files:
  - `docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/plan.md`
  - `docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/runlog.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- Verification:
  - 文本审查
- Acceptance:
  - 明确回答 3 个裁决：
    - 哪些事件必须统一 ingress
    - 宿主自动补哪些 adapter
    - imported app 最少暴露哪些边界 pin
- Rollback:
  - 回退 `0320` 文档

## Step 3

- Scope:
  - 评估对现有文档和后续实现的影响
- Files:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/runlog.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - 明确哪些现有页后续需要引用 0320
  - 不直接改写现有“当前事实”口径
- Rollback:
  - 回退本轮 planning 文档





```text
Rust。这上面就是这个：Deler 上面是 JS，Burn 上面也是 JS。这两个 JS 都比较全。

这两个 JS 为什么有疑问呢？因为这两个 JS 都很大，它有一个浏览器核心。这两个用的浏览器核心不一样：这个是 V8，这是苹果的那个 JSCore，然后是不一样的。但是这两个 JS 的核心都很大。

但是华为有一个叫 Arc TS，是华为的鸿蒙上的。这个 Arc TS 小到非常非常小，它可以在几百 K 的 RAM 的那个单片机上就能运行。所以连手表上都是 Arc TS 编的程序，这是华为的手表。所以我不知道它为什么那么小，现在我要经过去看看它为什么这么小，我不清楚了。

因为理论上说这么小的话，它这个 Arc TS 应该不是全的 JS 或者全的 TS，理论上说它应该是不全的。但是它到底缺什么？是不是华为这么编基本的功能就够了？这就是个编程语言了。对，华为的编程语言，鸿蒙的编程语言。

像 TS 就是 TS，TypeScript，就是 JS 一类的东西。但是它那个特别小，只有几十 K、上百 100 K RAM 就能运行；这个 JS 都要几兆 RAM，几十兆甚至上百兆 RAM 才能运行，差那么多，差很多很多倍。所以这个我不太清楚是这两个实现特别大，还是它这个特别精简，还是它这个少了很多东西。我现在还不理解这个东西，还要再看一下。

然后鸿蒙那个操作系统，大到它可以用一个 Linux 内核，上服务器都可以；小到它可以在那个小单片机上都能运行，就是这样。鸿蒙还挺厉害。

对，所以它上面都是这个 Arc TS 编程。那底层，鸿蒙的底层是这个 Rust。鸿蒙的底层是 Rust。

对，Rust 的下面是 C，所以 Rust 的：鸿蒙的做法是 Rust 生成 C，C 再用那个 GCC 或者 RVM（华为好像用的是 RRVM），C 再生成那个机器码，是这样的。

然后那个 Go 呢，是 Go 生成 C，然后 C 下层用 GCC 去生成那个机器码，这个不太一样，但是道理是差不多的。

这个底层没有 C，这个代替直接就是 C 编译器，它就直接能到各个硬件上，然后它自己相当于代替了 C 编译器。就是这个编译器它直接能编译 C 程序，所以是这样。

它上层都有 JS 程序这个东西。所以现在能选的底层大概就是这三种之一吧：Rust 的底层，还有这个的底层，还有 Flutter 的底层。



下面这部分可能就是去打比赛。我们比赛的那个 PPT 已经写好了，然后去打比赛。如果能拿到一些名次，或者能拿到一些融资的话，这个就可以开始。

只要有任何一个融资，这地方就可以开始了，因为单片机实在是花不了多少钱。包括 PC 机，这都花不了多少钱。只有这个地方要做外网、加什么、要做 AI 可能会贵，带 AI 的机器会贵。那这后话我可以晚点做：这些工业的小设备反而花钱少，反而能成批量量产成产品去卖，所以很快可以进入市场。这个创新智能我可以晚一点再做。

但是后面我要做这么小的设备，我必须要有一个刚才说的这种程序的核心，就是 REST 或者 Zip 或者 Docker；要不然我弄那么大的 Python，我进不了这么小的单片机。而且有了这个核心以后，Outside 我用 Python 也好，用 JS 也好，我的 JS 可以调用它，我的 Python 也可以调用它，比如说用它变了。它是很小的，速度又快。

我所谓 Tier 1 的这个东西，别人改不了的：它就是个调用，编译过去了。编译出来的程序，单片机里也是它，编译器里也是它；只不过你上层不放这个。如果是 2 个 TS 能移植过来，那整个你上面放 2 个 TS 也行；如果不移植过来，你就在它上面直接填模型表就做出来，反正功能都很简单嘛，对吧？就是这样。

所以必须有一个这样的小的硬内核，才能够深入嵌入。要不然我们直接在 Python 的话，我只能进不了深度嵌入式市场，只能在 PC 这一层上做。对对对，你当时说这个可以理解啊。

所以刚才为了做这个，我们准备的这一套。但这一套比较大，是好几年的规划，或者说未来五年的规划，所以它不是急着做的，不是眼前的事情，能把 Python 4 做到那个样子。因为我具身智能这个公司已经要成立了，马上招人来了，就面临着这些人要培训。你们不能自己都要靠你们去培训这些新来的人，你不能说我自己都还没说清楚我到底做的是啥，对吧？


```

```json
关于模型表（Model Table）读写权限及行为的规约修改建议

由于此次修改涉及项目 SSOT（Single Source of Truth）的变更，且需要对项目关键部分进行重构，以下是根据我的描述整理的规约草案，请审核：

1. 模型定义与基础结构
   (a) 涉及的模型类型包括 model.single、model.table 和 model.metrics。
   (b) 规约要求：每个 model 的第 0 格（Index 0）必须是 model.table 类型，且其 label 必须明确标注 modelType 为 model.table。

2. 默认程序模型与引脚配置
   Index 0 的 model.table 将包含三个默认的程序模型，共配置三对引脚（In/Out）：

   (a) 程序模型 1：模型表写入操作
       特指对当前 model.table 下所有单元格的写入。逻辑为：从 In 引脚触发，根据传入内容修改该 model.table 下任意单元格的 label。

   (b) 程序模型 2：管理总线消息接收（Bus In）
   (c) 程序模型 3：管理总线消息发送（Bus Out）

3. 双总线通信链路规范
   除了 Model 0 以外，其他模型不能直接发送总线消息，必须通过接口接入：

   (a) 发送链路：若 Model 100 的某个单元格需发送消息，须将其 Out 引脚连接至 Model 0 对应的“管理总线发送”In 引脚，通过父子模型层级向外透传。
   (b) 接收链路：消息从 Model 0 的 busIn 进入，逐级下发至子模型。若 Model 100 的某个单元格需接收消息，其 In 引脚必须连接至 Model 100 第 0 格（Index 0）的“收消息”Out 引脚。

4. 单元格读写权限细则
   (a) 写入权限限制：
       - 系统将暴露 VEN.addLabel 和 VEN.removeLabel 等函数给用户。
       - 单元格仅具备修改“自身”label 的权限。
       - 若需跨单元格修改 label，必须通过前述 Model 0 的通信链路实现。
   (b) 读取权限开放：
       - 系统将暴露 readLabel 函数，该函数支持传入 PRC 等参数。
       - 读取权限不作限制，支持读取当前模型下任何单元格的 label。

以上是本次规约修改的核心内容。审核通过后，我们将首先修改规约相关文档，随后再开展具体的重构任务。
```

