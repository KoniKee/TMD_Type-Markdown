# MD Editor - Typora 风格 Markdown 编辑器

一个类似 Typora 的本地 Markdown 编辑器，支持所见即所得的单栏编辑模式。

## 特性

- ✨ **所见即所得** - 输入 Markdown 语法，实时渲染展示
- 🎯 **单栏编辑** - 不是传统的左右两栏，而是直接在编辑区渲染
- 📝 **智能切换** - 光标所在位置显示源码，离开后渲染结果
- 🖼️ **图片粘贴** - Ctrl+V 粘贴图片，自动保存到 img 目录
- 📂 **目录树** - 左侧边栏查看文件结构
- 📑 **多标签页** - 支持同时打开多个文档
- 💾 **自动保存** - 文档修改自动保存
- 🌙 **主题切换** - 亮色/暗色/跟随系统

## 技术栈

| 技术 | 说明 |
|------|------|
| Tauri 2.0 | 桌面应用框架（Rust后端） |
| React 18 | 前端框架 |
| TypeScript | 类型安全 |
| ProseMirror | 编辑器引擎 |
| TailwindCSS | 样式方案 |
| Zustand | 状态管理 |
| Vite | 构建工具 |

## 项目结构

```
md_editor/
├── src-tauri/              # Rust后端
│   ├── src/
│   │   ├── main.rs         # 主入口
│   │   └── commands.rs     # IPC命令
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React前端
│   ├── components/
│   │   ├── Editor/         # ProseMirror编辑器
│   │   ├── Sidebar/        # 目录树
│   │   ├── Tabs/           # 标签页
│   │   ├── Layout/         # 布局组件
│   │   └── Settings/       # 设置面板
│   ├── stores/             # Zustand状态
│   ├── hooks/              # 自定义Hooks
│   ├── utils/              # 工具函数
│   └── styles/             # 全局样式
├── design/                 # 设计文档
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+B | 加粗 |
| Ctrl+I | 斜体 |
| Ctrl+` | 行内代码 |
| Ctrl+S | 保存 |

## 支持的 Markdown 语法

- 标题 (h1-h6)
- 段落
- 粗体、斜体、删除线
- 代码（行内和代码块）
- 链接、图片
- 列表（有序、无序）
- 引用
- 分割线
- 表格

## 开发

### 前置要求

- Node.js 18+
- Rust (用于 Tauri)
- Windows: Microsoft Visual Studio C++ Build Tools

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

## License

MIT
