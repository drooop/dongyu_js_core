---
title: "Slide Python Install Client v1"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Slide Python Install Client v1

## 这页负责什么

这页给同事一个可直接运行的 Python 例子，让他拿着 slide app zip 后，按当前正式主线把 app 安装到本项目。

它不是新的 Matrix room message 协议说明。

它走的仍然是当前正式安装链：

1. 需要时先登录 ui-server
2. 把 runtime 切到 `running`
3. 把 zip 发给 `/api/media/upload`
4. 拿到 `mxc://...`
5. 通过 `/bus_event` 写入 Model 0 的 `slide_import_media_uri_update` bus 输入，再由 pin route 写进 importer 真值模型的 `slide_import_media_uri`
6. 通过 `/bus_event` 写入 Model 0 的 `slide_import_click` bus 输入，再由 pin route 触发 importer 的 `click` pin

## 示例脚本

- `scripts/examples/slide_app_install_client.py`

这个脚本只用 Python 标准库，不需要额外安装包。

## 最常见用法

如果当前环境不要求页面登录，或者 ui-server 已经有可用的 Matrix 上传身份，直接运行：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
python3 scripts/examples/slide_app_install_client.py \
  --base-url http://127.0.0.1:30900 \
  --zip test_files/executable_import_app.zip
```

如果当前环境开启了鉴权，就把 Matrix 登录参数一起带上：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
python3 scripts/examples/slide_app_install_client.py \
  --base-url https://app.dongyudigital.com \
  --homeserver-url https://matrix.example.com \
  --username your_user \
  --password 'your_password' \
  --zip /path/to/your_slide_app.zip
```

## 参数

- `--base-url`
  - 当前 ui-server 地址
- `--zip`
  - 你要安装的 slide app zip
- `--homeserver-url --username --password`
  - 只在需要先登录 ui-server 时使用
- `--timeout`
  - HTTP 超时时间，默认 20 秒

## 成功后会看到什么

脚本会输出一段 JSON，里面至少会有：

- `upload.uri`
  - 上传后得到的 `mxc://...`
- `final.status`
  - importer 当前状态
- `final.last_app_name`
  - 最近导入的 app 名称
- `final.registry_match`
  - Workspace 侧边栏里匹配到的新 app 条目

只要 `registry_match` 不为空，就表示这个 app 已经出现在当前 Workspace 里。

## 脚本内部到底做了什么

脚本没有绕协议。

它做的事情就是：

1. 可选 `POST /auth/login`
2. `POST /api/runtime/mode`
3. `POST /api/media/upload?filename=...`
4. `POST /bus_event`
   - `type = bus_event_v2`
   - `bus_in_key = slide_import_media_uri_update`
   - `value` 是临时 ModelTable record array，外层为 `write_label.v1`，目标单元格是 importer truth `1031, 0,0,0` 的 `slide_import_media_uri`
5. `POST /bus_event`
   - `type = bus_event_v2`
   - `bus_in_key = slide_import_click`
   - `value` 是临时 ModelTable record array，外层为 `write_label.v1`，目标单元格是 importer button `1030, 2,4,0` 的 `click pin`
   - click pin 的值本身也是临时 ModelTable record array，至少包含 `__mt_payload_kind=ui_event.v1` 与 `target={model_id:1031,p:0,r:0,c:0}`；可以额外包含 `action=click` 作为审计信息
6. `GET /snapshot`
   - 确认 Workspace registry 里出现新 app

## 什么时候不要用它

不要把它理解成“直接往 Matrix 房间发一条自定义安装消息”的客户端。

当前项目里，受支持的安装路径仍然是：

- 通过当前 ui-server 的 `/api/media/upload` 做上传和 cache priming
- 再由 importer 完成安装

如果你需要看这条正式链的边界，继续看：

- `slide_matrix_delivery_v1.md`
- `slide_upload_auth_and_cache_contract_v1.md`
