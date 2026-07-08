# 软件工人模型2-标签与连接规则 v0

## PIN 连接规则

连接 payload 需要说明来源和目标。
连接 payload 必须保留 response_topic，方便提交动作找到返回通道。

## 权限边界

UI 是 ModelTable 的投影。
为了调试效率，UI 可以在特殊调试时直接修改业务状态。
