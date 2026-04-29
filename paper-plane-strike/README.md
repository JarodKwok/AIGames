# Paper Plane Strike

10x10 纸飞机对战游戏。当前保留 Web 版，并新增了原生微信小程序版。

## Web 版

```bash
npm install
npm run dev
npm run build
```

当前 Web 版可以构建运行。样式主要来自 Tailwind CDN，`index.css` 只保留基础页面样式。

## 微信小程序版

小程序源码在 `miniprogram/`，根目录 `project.config.json` 已配置 `miniprogramRoot`。

使用方式：

1. 打开微信开发者工具。
2. 导入本项目根目录。
3. 将 `project.config.json` 里的 `appid` 从 `touristappid` 改成自己的小程序 AppID。
4. 编译运行，确认无误后按微信平台流程上传审核。

小程序版功能：

- 手动布阵、随机布阵
- 电脑难度选择：简单、中级、困难
- 方向切换和位置确认
- 玩家攻击、AI 回合
- 命中、击毁、胜负结算
- 开场循环音乐、结算短曲、本地音效
- 最近 10 局胜负统计
- 中英文切换
