---
title: "Slide Matrix Delivery Preview v0"
doc_type: user-guide
status: active
updated: 2026-04-09
source: ai
---

# Slide Matrix Delivery Preview v0

> 说明：
> - 这是 `0304` 产出的接口预告，不是最终协议文档。
> - 目的是让协作者先按同一方向准备 slide app 包和投递方式。
> - 最终正式版会在后续迭代中补齐。

## 这份预告现在能确认什么

- slide app 的安装单元仍然是一个 zip。
- zip 里当前先只放一个 JSON 文件。
- JSON 文件直接使用临时模型表数组合同：
  - `id`
  - `p`
  - `r`
  - `c`
  - `k`
  - `t`
  - `v`
- metadata 不单独做 manifest，而是直接写成 root labels。
- `ui-server` 收到这个包后，会：
  1. 解包
  2. 校验
  3. 分配新的正数 `model_id`
  4. 挂到 Workspace
  5. 让用户可以 `Open`

## 协作者现在可以先准备什么

如果同事要先做 slide app 包，当前可以先按下面的最小集合准备：

- 一个 zip
- zip 内一个 JSON 文件
- JSON 内一个唯一的 slide app root model
- root `(0,0,0)` 至少带这些 labels：
  - `app_name`
  - `source_worker`
  - `slide_capable = true`
  - `slide_surface_type`
  - `from_user`
  - `to_user`
  - `ui_authoring_version = cellwise.ui.v1`
  - `ui_root_node_id`
  - `model_type`

## Matrix 投递的当前预告口径

当前目标方向是：

- remote worker 或协作者侧，不再手动去点 Workspace 导入
- 而是把这个 zip 作为一次 Matrix 消息的有效载荷发给 `ui-server` 对应接收方
- `ui-server` 收到后，走和当前 zip 导入等价的安装链

换句话说：

- 现在已经跑通的是“手动导入 zip”
- 后续要补的是“把这个 zip 通过 Matrix 消息送过来”

## 还没有最终冻结的部分

以下内容此时还只是预告，不应当当成最终协议：

- Matrix 消息的最终 event type / content type 命名
- zip 是直接放在消息体里，还是走附件 / 引用式传输
- 前端 submit 事件的最终目标合同
- 导入执行型 app 时，`func.js` 的最终安全白名单

## 事件链路的预告方向

后续 slide app 的 submit / action 目标不是“随便发给某个 model”。

当前冻结的方向是：

- 前端事件会指向“当前模型 + 当前单元格”
- 事件 envelope 中至少带：
  - `target.model_id`
  - `target.p`
  - `target.r`
  - `target.c`
- mailbox 之后的事件入口解释属于 runtime
- 合法链路从 `Model 0` 开始，经 pin/connect/父子传递，到达目标单元格程序模型的 `IN`

当前 built-in 现状补充：

- `Model 100` 的 submit 已开始使用这一方向的内置链路：
  - mailbox submit
  - runtime 派生 `Model 0` ingress key
  - `pin.connect.model` 路由到 `Model 100` 的 pin 输入
- Slide / Workspace 系统动作也已经开始使用同一方向的 runtime ingress：
  - `slide_app_import`
  - `slide_app_create`
  - `ws_app_add`
  - `ws_app_delete`
  - `ws_select_app` / `ws_app_select`
- 导入 app 的执行型链路还没开放，那会留到后续迭代。

所以协作者在准备 slide app 时，可以先按这个原则理解：

- UI 负责描述和触发事件
- 真正执行业务的是后端程序模型
- 单元格本身不靠“显式声明自己属于哪些模型”来决定执行，而靠引脚链传播

## 当前最接近真实流程的手测替身

如果现在还没接上 Matrix 投递，同事可以先用 Workspace 里的 `滑动 APP 导入` 做本地等价测试：

1. 打开 Workspace
2. 进入 `滑动 APP 导入`
3. 上传 zip
4. 点击 `导入 Slide App`
5. 确认新 app 出现在侧边栏
6. 打开并使用它

这条替身流程验证的是“安装链”，不是最终的 Matrix 投递协议本身。
