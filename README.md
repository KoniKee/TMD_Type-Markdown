# MD Editor - Typora 风格 Markdown 编辑器

一个类似 Typora 的本地 Markdown 编辑器，支持所见即所得的单栏编辑模式。

Markdown的实时渲染基于[Vanessa219/vditor: ♏ 一款浏览器端的 Markdown 编辑器，支持所见即所得（富文本）、即时渲染（类似 Typora）和分屏预览模式](https://github.com/Vanessa219/vditor) 项目搭建（感谢大佬的Markdown实时渲染项目，效果非常接近Typora，再次基础上仅修改了tab代码块，改为2中文缩进，有序列表缩进css渲染成不同序列表示）

## 特性

- ✨ **所见即所得** - 输入 Markdown 语法，实时渲染展示
- 🎯 **三种模式** - 所见即所得，实时渲染（类似Typora），分屏预览（古法md）
- 🖼️ **图片粘贴** - Ctrl+V 粘贴图片，自动保存到 img 目录并以相对路径引用图片（可配置目录名）
- 📂 **目录树** - 左侧边栏查看文件结构，支持目录和md文档的新建和重命名
- 📑 **多标签页** - 支持同时打开多个文档
- 💾 **自动保存** - 文档修改自动保存到本地文件
- 🌙 **主题切换** - 亮色/暗色模式
- ⌨️ **快捷键** - 支持 Ctrl+B/I/S 等快捷操作

## 功能截图

Markdown语法实时渲染，光标移动到附近显示Markdown源码方便修改


支持文档目录树和文档大纲

![PixPin_2026_05_03_22_48_07](img/1777819721913_PixPin_2026_05_03_22_48_07.png)

复制图片，直接将图片保存到文档同级目录的img目录（可配置修改目录名）下，并使用相对路径引用图片

![PixPin_2026_05_03_23_13_21](img/1777821204961_PixPin_2026_05_03_23_13_21.png)

支持在行首tab键缩进2个汉字，保持表格中tab键跳转到下一单元格，保持列表中tab键缩进层级，有序列表缩进层级渲染为不同的序列标识。

![PixPin_2026_05_03_23_17_03](img/1777821429732_PixPin_2026_05_03_23_17_03.png)

支持明暗两种主题

![PixPin_2026_05_03_23_20_09](img/1777821614787_PixPin_2026_05_03_23_20_09.png)

## 技术栈


| 技术         | 说明                |
| ------------ | ------------------- |
| React 18     | 前端框架            |
| TypeScript   | 类型安全            |
| Vditor       | Markdown 编辑器引擎 |
| TailwindCSS  | 样式方案            |
| Zustand      | 状态管理            |
| Vite         | 构建工具            |
| Lucide React | 图标库              |

## 项目结构

```
md_editor/
├── src/
│   ├── components/
│   │   ├── Editor/         # Vditor 编辑器
│   │   ├── Sidebar/        # 文件树
│   │   ├── Tabs/           # 标签页
│   │   ├── Toolbar/        # 工具栏
│   │   ├── Layout/         # 布局组件
│   │   └── Settings/       # 设置面板
│   ├── stores/             # Zustand 状态
│   ├── hooks/              # 自定义 Hooks
│   └── styles/             # 全局样式
├── src-tauri/              # Tauri 桌面应用配置（可选）
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 快捷键


| 快捷键       | 功能           |
| ------------ | -------------- |
| Ctrl+S       | 保存           |
| Ctrl+B       | 加粗           |
| Ctrl+I       | 斜体           |
| Ctrl+D       | 删除线         |
| Ctrl+M       | 插入表格       |
| Ctrl+=       | 表格插入行     |
| Ctrl+-       | 表格删除当前行 |
| Ctrl+Shift+= | 表格插入列     |
| Ctrl+Shift+- | 表格删除当前列 |

## 支持的 Markdown 语法

- 标题 (h1-h6)
- 段落
- 粗体、斜体、删除线
- 代码（行内和代码块）
- 链接、图片
- 列表（有序、无序、任务列表）
- 引用
- 分割线
- 表格
- 脚注

## 开发

### 前置要求

- Node.js 18+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建 Web 版本

```bash
npm run build
```

## 桌面应用

### 系统要求


| 操作系统 | 最低版本         | 说明             |
| -------- | ---------------- | ---------------- |
| Windows  | 10 (1803+)       | Windows 7 不支持 |
| macOS    | 10.15 (Catalina) | -                |
| Linux    | -                | 支持 x86_64 架构 |

### WebView2 运行时（仅 Windows）

Tauri 应用在 Windows 上依赖 Microsoft Edge WebView2 运行时：


| 系统               | 自带 WebView2 | 绿色版      | 安装包      |
| ------------------ | ------------- | ----------- | ----------- |
| Windows 11         | ✅ 是         | ✅ 直接用   | ✅ 直接用   |
| Windows 10 (21H2+) | ✅ 大部分有   | ✅ 可用     | ✅ 直接用   |
| Windows 10 (旧版)  | ❌ 可能没有   | ⚠️ 需安装 | ✅ 自动安装 |

如果使用绿色版遇到缺少运行时的问题，请下载安装：
https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section

选择 **"Evergreen Bootstrapper"** 下载安装。

### 自动构建

桌面应用通过 GitHub Actions 自动构建，无需本地安装 Rust 或其他编译工具。

推送代码到 GitHub 后，Actions 会自动打包：


| 平台    | 产物                                 |
| ------- | ------------------------------------ |
| Windows | `.msi` 安装包、`.exe` 安装包、绿色版 |
| macOS   | `.dmg` 安装包、`.app`                |
| Linux   | `.deb` 安装包、`.AppImage`           |

### 下载

前往 [Releases](https://github.com/KoniKee/TMD_Type-Markdown/releases) 页面下载最新版本。

## License

MIT
