# Web Demo

`apps/web/demo` 只保留前端演示页。后端不再维护独立 demo server；这些页面由正式 API 服务静态托管到 `/demo`。

## 正式入口

- [login.html](login.html)：demo 区的正式入口页。

## 保留的功能演示

- [status.html](status.html)：Socket/在线状态诊断页，可从登录页跳转。
- [vue-review-workbench.html](vue-review-workbench.html)：Vue 版批阅工作台视觉与交互原型。

## 访问方式

启动正式 API 服务后访问：

```bash
npm run start:auth -w @linksee/api
```

然后打开：

- `/demo/login.html`
- `/demo/vue-review-workbench.html`

说明：`vue-review-workbench.html` 当前通过 CDN 引入 Vue 3，仅用于快速查看界面效果；正式接入 Vue/Vite 时应改为本地依赖和构建产物。
