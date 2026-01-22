# V1N / PICtest 软件工人基座：概念与实现理解

## 0. 阅读范围与假设
- 本文档基于当前仓库中的 PICtest 源码状态
- 若上游变更，本文档需要同步更新
- 已阅读 PICtest / 软件工人基座相关源码：`PICtest/`（例如 `PICtest/__main__.py`、`PICtest/yhl/main.py`、`PICtest/yhl/v1n.py`、`PICtest/yhl/core.py`、`PICtest/yhl/labels.py`、`PICtest/yhl/Connect/*`）与其在本仓库中的集成代码 `packages/pyservice/src/pyservice/worker_base.py`、`packages/pyservice/src/pyservice/main.py`
- 佐证方式：使用“文件路径 / Python 模块名 / 启动流程步骤”引用源码来说明判断依据
- 不确定之处统一标注“待确认”，本文档不做臆测

## 1. 软件工人基座的系统角色
- 在 dongyu 小系统中的位置：运行时形态为后端服务的一部分，由 `packages/pyservice/src/pyservice/main.py` 启动 FastAPI，并在启动事件中调用 `packages/pyservice/src/pyservice/worker_base.py#configure_worker_base` 将 PICtest 的 studio 应用挂载到 HTTP 路径（默认 `/worker-base`，来源 `packages/pyservice/src/pyservice/settings.py`）
- 与“模型表滑动 UI 小 APP”的关系：模型表滑动 UI 由前端 SPA 承担（`packages/frontend`），其通过 `packages/frontend/src/api/client.ts` 将 `WORKER_BASE_URL` 固定为 `${API_BASE_URL}/worker-base`，并在 `packages/frontend/src/pages/WorkerBase.vue` 使用 `iframe` 加载该页面；因此 UI 与基座通过 HTTP 路径发生集成关系
- 明确：它不是 App、本身不承载 UI：在系统分层上，dongyu 的用户交互 UI 位于 `packages/frontend`；软件工人基座以服务/sidecar 的形式对外提供运行时与管理界面入口（`/worker-base`），并不等同于前端 SPA（待确认：业务层对“UI”的定义是否把 `PICtest/yhl/studio` 视为管理 UI 而非产品 UI）

## 2. 源码结构总览
- 顶层目录结构说明（路径 + 作用）
  - `PICtest/`：V1N/PICtest 运行时与内置工作区资源（`PICtest/yhl/*` 为核心；`PICtest/v1n/*` 为工作区数据与代码；`PICtest/yhl/studio/*`、`PICtest/yhl/model_UI_base/*` 为 NiceGUI/Starlette UI）
  - `packages/pyservice/`：dongyu 后端服务（FastAPI），包含 Matrix/Jitsi 辅助与 worker base 挂载（`packages/pyservice/src/pyservice/main.py`、`packages/pyservice/src/pyservice/worker_base.py`）
  - `packages/frontend/`：Vue3 + Vite 前端 SPA，包含“软件工人基座”页面入口（`packages/frontend/src/pages/WorkerBase.vue`）
  - `apps/desktop-tauri/`：桌面壳（Tauri），负责拉起后端 sidecar 并加载前端页面（`apps/desktop-tauri/src-tauri/src/main.rs`、`apps/desktop-tauri/src-tauri/tauri.conf.json`）
  - `apps/android-native/`：Android 壳（Chaquopy + WebView），在 App 进程内启动 Python 后端并加载前端静态资源（`apps/android-native/app/src/main/python/bootstrap.py`、`apps/android-native/app/src/main/java/.../MainActivity.kt`）
  - `scripts/`：辅助脚本（如 `scripts/build-android.sh`、`scripts/run-python.js`），用于构建/验收
- 哪些目录属于“运行时核心”
  - PICtest 运行时核心：`PICtest/yhl/core.py`（Model/Cell/Label 与 SQLite 持久化）、`PICtest/yhl/v1n.py`（V1N 单例与工作区）、`PICtest/yhl/function.py`（函数执行）、`PICtest/yhl/labels.py`（标签/连接/引脚标签）、`PICtest/yhl/Connect/*`（引脚连接与对外通道）、`PICtest/yhl/utils.py`（加载/连接初始化）
  - dongyu 集成核心：`packages/pyservice/src/pyservice/main.py`（FastAPI 入口与挂载）、`packages/pyservice/src/pyservice/worker_base.py`（把 PICtest studio 作为子应用挂到 `/worker-base`）
- 哪些属于“工具/打包/sidecar”
  - PyInstaller/sidecar 构建：`packages/pyservice/scripts/build.py`（打包 `pyservice` 并将 `PICtest/`、`PICtest.tar.gz`、前端 `dist` 等作为资源注入）
  - Desktop 壳侧：`apps/desktop-tauri/src-tauri/*`（sidecar 生命周期管理、窗口导航、bundle 外置二进制配置）
  - Android 壳侧：`apps/android-native/app/build.gradle`（Chaquopy 依赖与 python 源目录）、`scripts/build-android.sh`、根目录 `package.json#sync:android-assets`

## 3. 启动与运行流程
- 启动入口文件（路径）
  - dongyu 小系统后端入口：`packages/pyservice/src/pyservice/main.py`（定义 FastAPI `app`，并调用 `configure_worker_base(app, settings)`）
  - PICtest 独立入口（仓库内存在）：`PICtest/__main__.py`（解析 CLI 参数并调用 `yhl.main.init_and_run`）
- 启动顺序（用步骤列表）
  1. FastAPI 进程启动：`uvicorn` 运行 `pyservice.main:app`（`packages/pyservice/src/pyservice/main.py` / `packages/pyservice/scripts/dev.sh`）
  2. `configure_worker_base` 注册 `startup/shutdown` 钩子（`packages/pyservice/src/pyservice/worker_base.py#configure_worker_base`）
  3. FastAPI `startup` 时执行 `WorkerBaseLauncher.start`（同文件），内部先 `mount` 再进入 lifespan
  4. `_load_app` 做运行前准备（`packages/pyservice/src/pyservice/worker_base.py#WorkerBaseLauncher._load_app`）：
     - 解析/补齐 `PICtest` 资源路径并加入 `sys.path`（`WorkerBaseLauncher._ensure_worker_base_on_path`）
     - 针对 PyInstaller/Android 做兼容 patch（`_bootstrap_internal_paths`、ProcessPoolExecutor patch、TemplateResponse patch）
     - 调用 `yhl.main.init(v1n_name, mode, v1n_id)` 初始化 V1N（`PICtest/yhl/main.py#init`）
     - 导入并返回 `yhl.studio.src.main.app`（`PICtest/yhl/studio/src/main.py`，NiceGUI 运行在该 Starlette app 上）
  5. 将 studio app 挂载到 `/worker-base`（默认值来自 `packages/pyservice/src/pyservice/settings.py#Settings.worker_base_mount_path`）
- 运行期保持的核心对象/状态
  - V1N 全局单例：`PICtest/yhl/v1n.py` 中 `_global_v1n`，由 `initialize_v1n` 创建并由 `get_v1n` 全局访问；其中保存 `name/mode/v1n_id`、主模型 `_model`、连接管理器 `connect_manage` 以及 Matrix/MQTT 配置字段
  - 模型表对象树：`PICtest/yhl/core.py` 的 `Model`/`Cell`/`Label` 实例树（主模型名固定为 `MT`，见 `PICtest/yhl/v1n.py#V1N.init_main_model`）；子模型通过 `SubmtLabel` 加载并挂在 `Model.submts_map`
  - 连接与引脚状态：`PICtest/yhl/Connect/manageCell.py`、`PICtest/yhl/Connect/manageModel.py`、`PICtest/yhl/Connect/manageV1N.py` 的 `pin_dict` / `connections`；对外通道通过 `PICtest/yhl/MQTT/MQTT.py#MQTT_Client_Manager`（以及 `PICtest/yhl/Connect/manageModelUI.py` 的 Matrix 通道）持有运行时连接

## 4. 模型表相关机制
- 模型表如何被加载
  - 工作区路径解析：
    - 模板/资源路径：`PICtest/yhl/config.py` 通过 `WORKDIR` 指向 `PICtest/v1n/`（脚本运行）或 PyInstaller bundle 内的 `v1n`（冻结运行）
    - 持久化路径：`DATA_ROOT`/`DATA_WORKDIR` 指向用户数据目录下的 `.../dongyuapp/worker_base/data/v1n`，并将 `DATA_ROOT` 加入 `sys.path` 以便加载 `v1n.<name>.main`
    - override：`DONGYUAPP_DATA_DIR` / `WORKER_BASE_DATA_DIR` 可显式指定持久化根目录；`WORKER_BASE_CACHE_DIR` 存在时默认使用 `${WORKER_BASE_CACHE_DIR}/data`
  - 数据文件选择：`PICtest/yhl/v1n.py#V1N.init_file` 调用 `PICtest/yhl/core.py#update_db_file` 将全局 `DB_FILE` 指向 `${DATA_WORKDIR}/{v1n.name}/yhl.db`
    - 若持久化 DB 不存在：从旧路径候选（如 `WORKDIR`、`worker_base/PICtest/v1n`、`_MEI*` 临时目录）选择最新 `mtime` 的 DB 迁移；否则回退使用 `WORKDIR` 的模板 DB/空文件
  - 主模型加载：`PICtest/yhl/v1n.py#V1N.init_main_model` 调用 `PICtest/yhl/core.py#Model.from_db(mt_name="MT", mt_id=0)` 加载主模型；加载失败时创建新 `Model(name="MT", id=0, model_type="main")` 并持久化
  - 子模型加载：`PICtest/yhl/labels.py#SubmtLabel.label_init` 在初始化阶段调用 `Model.from_db(mt_id=submt_id, mt_name=submt_path)` 将子模型从同一 `DB_FILE` 加载并挂到父模型 `submts_map`
  - 基线工作区示例（仓库内现状）：
    - `PICtest/v1n/dongyuapp/yhl.db` 仅包含主模型基本标签（`mt_data` 行数为 2：`model_type=main`、`v1n_id=None`）
    - `PICtest/v1n/test/yhl.db` 包含多 `mt_id` 的模型树与 `submt` 标签（例如 `MT/员工申报界面`、`MT/审批流程` 等）
- 模型表如何被执行/调度
  - 代码装配入口：`PICtest/yhl/main.py#init` 在加载模型后调用：
    - `PICtest/yhl/utils.py#load_model_function`：遍历子模型并调用各模型的 `init_function`（如 `PICtest/yhl/model_Data_base/data.py#DataModel.init_function`、`PICtest/yhl/model_Flow_base/flow.py#FlowModel.init_function`）
    - `PICtest/yhl/utils.py#load_user_function`：动态导入 `v1n.{v1n_name}.main:init_cell`（文件位于 `${DATA_WORKDIR}/{v1n_name}/main.py`，模板来源于 `${WORKDIR}`），由该函数使用 `v1n.init_cellcode(...)` 把代码绑定到具体 Cell/Function
    - `PICtest/yhl/utils.py#load_v1n_function_label`：扫描 `FunctionLabel` 并调用 `Model.add_method` 将函数暴露为模型方法
    - `PICtest/yhl/utils.py#load_all_model_pin_connect`：初始化各层级 `connect_manage`，从 `IN/OUT/LOG_*` 标签恢复引脚，并根据 `CELL_CONNECT/MODEL_CONNECT` 等连接表恢复引脚连接关系
  - 执行触发与调度方式（源码定义的三种入口）
    - 显式调用：`PICtest/yhl/core.py#Cell.run` 通过 `asyncio.create_task` 调度 `PICtest/yhl/function.py#Function.run`
    - RunLabel 触发：`PICtest/yhl/labels.py#RunLabel.label_init` 在事件循环存在时将 `run_<func>` 标签转为 `Cell.run(func)`（初始化阶段会直接返回，不触发）
    - 引脚触发：`PICtest/yhl/function.py#Function.__init__` 为每个函数创建 `$<name>_cin$/$<name>_cout$/$<name>_lout$` 引脚；`PIN.receive` 会触发 `specialHandle`，其中 `Function.handle_call` 将输入转换为 `Label` 并调用 `Function.run`
  - 结果回传：`Function.run` 在获得 `result` 后调用 `PIN.save_` 把结果写回为 Label，并通过 `PIN.receive` 将值广播到连接的引脚（`PICtest/yhl/Connect/PIN.py`）
- 哪些能力属于“基座内建”，哪些由模型表决定
  - 基座内建（代码提供且不依赖具体模型表内容）
    - 模型/单元格/标签数据结构与 SQLite schema：`PICtest/yhl/core.py`（表 `mt_data`）
    - 标签类型体系与初始化行为：`PICtest/yhl/labels.py`（`SubmtLabel/FunctionLabel/RunLabel/ConnectLabel` 与 `LABEL_REGISTRY`）
    - 函数执行与动态代码装配：`PICtest/yhl/function.py`、`PICtest/yhl/v1n.py#V1N.init_cellcode`
    - 引脚/连接与对外通道：`PICtest/yhl/Connect/*`、`PICtest/yhl/MQTT/MQTT.py`、`PICtest/yhl/Connect/manageModelUI.py`（MQTT/Matrix）
    - 内置 UI 形态：`PICtest/yhl/studio/src/main.py`（studio）、`PICtest/yhl/model_UI_base/*`、`PICtest/yhl/model_Markdown_base/*`（NiceGUI 展示）
  - 由模型表决定（同一套引擎在不同 `yhl.db` + `main.py` 下表现不同）
    - 子模型树结构与模型类型（通过 `model_type` 与 `submt` 标签决定，加载路径见 `Model.from_db` / `SubmtLabel.label_init`）
    - 单元格标签内容（业务数据、连接表、方法标签等）与引脚连接关系（`CELL_CONNECT/MODEL_CONNECT/...`）
    - 具体可运行的函数集合与业务语义（由 `v1n/<name>/main.py:init_cell` 和各 `Model.init_function` 共同装配）

## 5. 对外交互边界（抽象）
- 接收指令的方式（概念描述）
  - HTTP：dongyu 侧通过 FastAPI 提供的服务入口对外暴露（`packages/pyservice/src/pyservice/main.py`），其中 worker base UI 以子应用形式挂载到 `Settings.worker_base_mount_path`（默认 `/worker-base`）
  - MQTT：V1N 级别与 UI 模型级别存在固定 topic 规则
    - V1N 引脚 topic：`PICtest/yhl/Connect/manageV1N.py` 使用 `USERPUT/{v1n_id}/{pin_name}/{pin_type}` 进行收发
    - UI 模型引脚 topic：`PICtest/yhl/Connect/manageModelUI.py` 使用 `UIPUT/{v1n_id}/{model_id}/{pin.name}/{pin.pin_type}` 进行收发
    - 待确认：本仓库内未找到其他模块引用上述 topic 字符串，topic 规则是否属于对外契约取决于上游系统
  - Matrix：当 `V1N.mode == "app"` 时，`PICtest/yhl/Connect/manageModelUI.py` 通过 `MatrixClientManager` 建立通道（room id 在代码中硬编码为 `!MeXftFuWFKFgLcghQC:m2m.yhlcps.com`）
- 返回状态/结果的方式
  - 通过标签存储状态：函数结果通过 `PIN.save_` 写入为标签（`PICtest/yhl/Connect/PIN.py`、`PICtest/yhl/labels.py`），并可被 UI 或后续函数读取
  - 通过引脚传播结果：`PIN.receive` 将值广播到连接的引脚并触发下游执行（`PICtest/yhl/Connect/PIN.py`、`PICtest/yhl/Connect/manageCell.py`、`PICtest/yhl/Connect/manageModel.py`）
  - 通过日志引脚输出：`Cell.print/error` 与 `Function.print/error` 会向 `$cell_lout$` 或 `$<func>_lout$` 写出结构化日志（`PICtest/yhl/core.py`、`PICtest/yhl/function.py`）
- 明确哪些是稳定接口，哪些是易变点
  - 稳定接口（在仓库内存在明确调用方/引用者）
    - `/static/`：desktop 壳在 `apps/desktop-tauri/src-tauri/tauri.conf.json` 与 `apps/desktop-tauri/src-tauri/src/main.rs` 固定导航到 `http://127.0.0.1:15100/static/`；后端在 `packages/pyservice/src/pyservice/main.py#mount_static` 挂载前端构建产物
    - `/worker-base/`：前端在 `packages/frontend/src/api/client.ts` 固定拼接 `WORKER_BASE_URL`，并在 `packages/frontend/src/pages/WorkerBase.vue` 以 iframe 使用
    - `APP_PORT=15100`：desktop 壳默认端口为 `apps/desktop-tauri/src-tauri/src/main.rs#DEFAULT_PORT`；后端默认端口为 `packages/pyservice/src/pyservice/settings.py#Settings.app_port`
  - 易变点（仓库内未形成跨模块引用/或在运行时依赖较多环境假设）
    - worker base 内部的 NiceGUI 页面与组件结构（如 `PICtest/yhl/studio/src/endpoints/index.py` 的 `/` 页面与组件树）
    - worker base 对 PICtest 资源定位与 PyInstaller `_internal` 结构的兼容逻辑（`packages/pyservice/src/pyservice/worker_base.py`、`PICtest/yhl/config.py`）
    - MQTT/Matrix topic 与 room id：在 PICtest 内部硬编码（`PICtest/yhl/Connect/manageV1N.py`、`PICtest/yhl/Connect/manageModelUI.py`），但仓库内缺少调用方引用（待确认：上游系统是否依赖其语义）

## 6. 平台集成分析
### 6.1 Desktop（Tauri / Sidecar）
- 基座如何被拉起
  - Tauri 在启动时创建 sidecar：`apps/desktop-tauri/src-tauri/src/main.rs` 使用 `app_handle.shell().sidecar("pyservice")` 启动后端，并以 `APP_PORT` 环境变量传入端口
  - sidecar 就绪判定：同文件 `wait_for_pyservice` 轮询 TCP 端口连通性，超时直接报错并阻断 UI 导航
  - worker base 挂载：sidecar 内部 FastAPI `startup` 时执行 `configure_worker_base`（`packages/pyservice/src/pyservice/worker_base.py`）
- 产物形态（binary / script / resource）
  - sidecar 二进制：`apps/desktop-tauri/src-tauri/tauri.conf.json#bundle.externalBin` 配置外置 `binaries/pyservice`
  - 打包脚本：`packages/pyservice/scripts/build.py` 使用 PyInstaller 生成 `pyservice`，并通过 `--add-data` 注入：
    - 前端构建产物 `packages/frontend/dist`（挂载点为 `packages/frontend/dist`，由 `pyservice.main.mount_static` 使用）
    - `PICtest/` 目录与 `pictest_bundle.tar.gz`（供 `pyservice.worker_base.WorkerBaseLauncher` 定位/解压）
    - sqlite fallback 二进制（`--add-binary`，由 `WorkerBaseLauncher._ensure_sqlite_available` 使用，见 `packages/pyservice/src/pyservice/worker_base.py`）
- 常见集成风险点
  - 端口冲突：desktop 默认端口固定为 `15100`（`apps/desktop-tauri/src-tauri/src/main.rs`），冲突时启动失败路径明确
  - 资源定位耦合：PyInstaller `_internal`、`_MEIPASS`、macOS Frameworks 等路径在 `PICtest/yhl/config.py` 与 `packages/pyservice/src/pyservice/worker_base.py` 中被显式枚举；产物结构变化会直接影响启动
  - NiceGUI 资源路径：`packages/pyservice/scripts/build.py#ensure_nicegui_assets` 与 `packages/pyservice/src/pyservice/worker_base.py#_ensure_nicegui_assets` 均包含“将 `_internal/nicegui` 镜像到顶层”的逻辑，属于对运行目录结构的强耦合点
  - 日志定位：worker base fallback 页面提示检查 `~/.dongyuapp_pyservice.log`（`packages/pyservice/src/pyservice/worker_base.py`），但仓库内未找到该文件的写入逻辑（待确认：sidecar 启动参数或外部包装是否负责重定向日志）

### 6.2 Android
- 基座如何嵌入或伴生
  - 后端启动：`apps/android-native/app/src/main/java/.../MainActivity.kt#startPythonAndLoad` 使用 Chaquopy 启动 Python，并调用 `apps/android-native/app/src/main/python/bootstrap.py#run_server` 在后台线程运行 `uvicorn.run(pyservice.main:app)`（绑定 `127.0.0.1:15100`）
  - 前端加载：Android WebView 直接加载资产 `file:///android_asset/dist/index.html`（`MainActivity.kt#loadWebApp`）；该路径与根目录脚本 `package.json#sync:android-assets`、`scripts/build-android.sh` 的资源同步行为一致
- 与壳层的进程/生命周期关系
  - `bootstrap.py` 使用 `daemon=True` 的线程启动 uvicorn；`MainActivity.onDestroy` 未包含停止后端线程的逻辑（待确认：App 生命周期在目标环境中是否依赖进程退出来回收该线程）
  - WebView 侧允许 `file://` 访问 `http://127.0.0.1`：`MainActivity.kt#configureWebView` 启用 `allowUniversalAccessFromFileURLs`；网络层在 `apps/android-native/app/src/main/res/xml/network_security_config.xml` 放行 loopback cleartext
- 常见集成风险点
  - worker base UI 依赖：Android Chaquopy pip 依赖列表不包含 `nicegui`（`apps/android-native/app/build.gradle`），而 worker base 依赖导入 `nicegui`（`PICtest/yhl/studio/src/main.py`）；因此 `pyservice.worker_base` 启动会抛异常并进入 fallback（`packages/pyservice/src/pyservice/worker_base.py#configure_worker_base` 捕获异常并挂载失败页）
  - 资源缺失：Android 的 python `sourceSets` 未包含 `PICtest/`（`apps/android-native/app/build.gradle`）；`pyservice.worker_base` 的 PICtest 定位逻辑包含“Chaquopy 扁平化布局”的分支（`packages/pyservice/src/pyservice/worker_base.py#_locate_pictest_package`），但当前工程树中未看到对应的打包动作（待确认：Android 版本是否通过其他方式提供 PICtest 资源，或通过 `WORKER_BASE_ENABLED=0` 关闭该能力）

## 7. 上游变更风险清单
- 依赖变更风险
  - Starlette/NiceGUI 兼容性：`packages/pyservice/src/pyservice/worker_base.py` 内对 `TemplateResponse` 与 `NiceGUIClient.run_javascript` 做了 monkey patch，属于对上游 API 形态的显式耦合
  - Python/SQLite：`packages/pyservice/scripts/build.py` 与 `packages/pyservice/src/pyservice/worker_base.py` 明确处理 `_sqlite3` fallback；Python 版本或打包布局变化会影响该逻辑
  - MQTT/Matrix SDK：对外通道依赖 `aiomqtt` 与 `MatrixClientManager`（`PICtest/yhl/MQTT/MQTT.py`、`PICtest/yhl/Connect/manageModelUI.py`），上游 SDK 行为变化会影响通道稳定性
- 路径/产物结构风险
  - PyInstaller `_internal`、`_MEIPASS`、Frameworks：`PICtest/yhl/config.py` 与 `packages/pyservice/src/pyservice/worker_base.py` 枚举路径；产物目录结构变化会导致资源不可达
  - Tauri sidecar 名称与 bundle 位置：`apps/desktop-tauri/src-tauri/src/main.rs` 固定使用 sidecar 名称 `pyservice`；`apps/desktop-tauri/src-tauri/tauri.conf.json` 固定外置 `binaries/pyservice`
  - 前端静态资源位置：FastAPI 侧挂载路径固定为 `packages/frontend/dist`（`packages/pyservice/src/pyservice/main.py`），Android 侧固定为 `apps/android-native/app/src/main/assets/dist`（根目录 `package.json`、`scripts/build-android.sh`）
- 接口语义变化风险
  - 模型表持久化 schema：`PICtest/yhl/core.py#Model.init_db` 固定表结构 `mt_data(mt_id,p,r,c,k,t,v,s,i,m)`，对字段语义有隐式约束
  - 连接表结构：`ConnectLabel` 对 `CELL_CONNECT/MODEL_CONNECT/V1N_CONNECT` 的数据结构有类型检查与初始化触发（`PICtest/yhl/labels.py`），变更会影响连接恢复
  - MQTT topic/Matrix room id：对外通道 topic/room id 在代码中硬编码（见第 5 节），语义变化会影响跨系统联动（待确认：上游是否把这些视为契约）

## 8. 建议的工程对策（不写实现）
- 契约化接口建议
  - 明确并文档化“跨模块被引用”的接口：`/static/`、`/worker-base/`、`APP_PORT`（见第 5 节稳定接口）
  - 对 MQTT topic 与 Matrix room id 单独做契约声明：若上游依赖其语义，则把格式/字段含义从代码中抽离为配置并加版本号（待确认：上游是否依赖）
- 版本锁定/能力探测
  - 将 worker base 能力显式开关化：通过 `WORKER_BASE_ENABLED`（已有，见 `packages/pyservice/src/pyservice/settings.py`）在 Android 等缺少依赖环境中关闭，并提供可观测的健康信息
  - 对 NiceGUI/Starlette/Python 版本建立约束清单：当前存在 monkey patch，需把“依赖版本范围”与“触发条件”写入工程文档（避免 silent break）
- 验收脚本的必要性
  - 将“能否启动 worker base 并返回页面”作为脚本化验收项，而不是依赖人工打开 UI（与仓库测试指南一致）

## 9. 下一步可执行任务
- 编写脚本：启动 `pyservice.main:app` 后验证 `/health`、`/static/index.html`（若存在）、`/worker-base/` 的 HTTP 状态码与关键响应片段（验收方式：脚本返回码 + 输出摘要）
- 编写脚本：在纯 Python 环境执行 `yhl.main.init(v1n_name, mode, v1n_id)` 并验证 `get_v1n().get_model()` 能从 `PICtest/v1n/<name>/yhl.db` 成功加载（验收方式：打印加载到的 `mt_id` 列表/行数并断言）
- 编写脚本：解析 `yhl.db` 中的 `connect`/`submt`/`function` 标签一致性（例如 `submt` 指向的 `mt_id` 必须存在；`MODEL_CONNECT/CELL_CONNECT` 的 key/value 结构满足 `labels.py` 的类型约束）（验收方式：发现不一致即退出非零）
- 编写脚本：对 desktop 产物目录执行“资源完整性检查”（`binaries/pyservice`、`pictest_bundle.tar.gz`、`PICtest/`、`packages/frontend/dist` 注入情况）（验收方式：文件存在性与大小阈值检查）
- 编写脚本：对 Android 侧做“能力探测”校验（检测 Chaquopy 环境依赖集合是否包含 `nicegui`、是否提供 PICtest 资源；若缺失则必须设置 `WORKER_BASE_ENABLED=0` 或接受 fallback 页面）（验收方式：脚本输出缺失项列表并给出明确通过/失败条件）
