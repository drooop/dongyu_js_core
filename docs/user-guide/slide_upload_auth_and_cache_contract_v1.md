---
title: "Slide Upload Auth And Cache Contract v1"
doc_type: user-guide
status: active
updated: 2026-04-10
source: ai
---

# Slide Upload Auth And Cache Contract v1

## 这页负责什么

这页只冻结两件事：

- slide 导入上传时，`/api/media/upload` 的鉴权前提
- `slideImportAppFromMxc()` 对 media cache-priming 的要求

它不重复解释 zip 包格式、metadata 或 app 内部 pin 链。这些继续看：

- `slide_matrix_delivery_v1.md`

## 合同 1：上传先看当前环境是否开启鉴权

上传入口是：

- `/api/media/upload`

### 如果开启了鉴权

- 浏览器这一侧必须先登录
- 未登录会先直接返回：
  - `not_authenticated`
- 在这种环境里，就算 server 自己已经配置了 Matrix bot / MBR 凭据，也不能替代页面登录

### 如果没有开启鉴权

- 当前请求不需要先过页面登录
- 但上传仍然需要可用的 Matrix 身份
- 这时允许两种来源：
  - 当前请求已经带有可用的 Matrix session
  - server 自己已经配置了可用的 Matrix bot / MBR 凭据
- 如果两边都没有，上传会返回：
  - `matrix_session_missing`

## 合同 2：cache priming 的正式入口只有当前 ui-server 的上传路由

当前唯一受支持的 cache priming 入口是：

- 当前 ui-server 的 `/api/media/upload`

上传成功后，会同时发生两件事：

1. 文件进入 Matrix media，得到 `mxc://...`
2. 当前 ui-server 把这个媒体缓存下来，供后续 slide 导入使用

## 合同 3：slide 导入只接受“当前 ui-server 已缓存”的媒体

`slideImportAppFromMxc()` 当前只接受：

- 当前 ui-server 已缓存的 `mxc://...`

如果只是“别处已经上传过，手里有一个 `mxc://...`”，但这个 URI 没有经过当前 ui-server 的 cache priming，那么导入会直接返回：

- `media_not_cached`

## 最短正确路径

1. 先把 zip 发给当前 ui-server 的 `/api/media/upload`
2. 拿到上传返回里的 `mxc://...`
3. 把这个 URI 写进 importer 真值模型的 `slide_import_media_uri`
4. 再触发 importer host 的 `click` pin

## 明确不支持的做法

- 在开启鉴权的环境里，页面没登录就直接上传
- 只依赖 server 自己的 Matrix 凭据，试图绕过页面鉴权
- 把 zip 上传到别的 Matrix 客户端或别的 server
- 直接拿别处得到的 `mxc://...` 来触发当前 ui-server 的导入

## 相关错误码

- `not_authenticated`
  - 页面鉴权先拦住了上传请求
- `matrix_session_missing`
  - 请求和 server 两侧都拿不到可用 Matrix 上传身份
- `media_not_cached`
  - 当前导入看到的 `mxc://...` 没有经过当前 ui-server cache priming
