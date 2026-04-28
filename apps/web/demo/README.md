# Demo 页面

- [login.html](login.html)：登录按钮页（仅写入 demo token）
- [status.html](status.html)：在线状态页（基于 Socket 显示在线/离线）

## 心跳检测能力

- 客户端定时发送 `heartbeat:ping`
- 服务端返回 `heartbeat:pong` 并在终端输出心跳日志
- 状态页展示心跳状态与延迟（RTT）
- 服务端超过超时阈值未收到心跳会主动断开连接

## 运行

1. 在仓库根目录执行依赖安装
- npm install

2. 启动 demo 服务
- npm run demo:start

3. 运行 Socket 烟雾测试（可选）
- npm run test:socket-demo -w @linksee/api

3.1 观察服务端终端日志（心跳）
- 预期出现类似 `[demo][heartbeat] socket=... seq=... rttMs=...`

4. 打开页面
- https://localhost:3443/login.html
- https://localhost:3443/status.html

说明：

- 默认使用 HTTPS（自签名证书，浏览器会提示不受信任，手动继续即可）
- 若只测 HTTP，可设置 DEMO_HTTPS=false
- 可通过环境变量调整心跳参数：`DEMO_HEARTBEAT_INTERVAL_MS`、`DEMO_HEARTBEAT_TIMEOUT_MS`
- 烟雾测试脚本位置：[apps/api/src/demo/socket-smoke.mjs](../../api/src/demo/socket-smoke.mjs)
