# MD Editor - Typora 风格 Markdown 编辑器

一个类似 Typora 的本地 Markdown 编辑器，支持所见即所得的单栏编辑模式。

## 特性

- ✨ **所见即所得** - 输入 Markdown 语法，实时渲染展示
- 🎯 **单栏编辑** - 不是传统的左右两栏，而是直接在编辑区渲染
- 🖼️ **图片粘贴** - Ctrl+V 粘贴图片，自动保存到 img 目录
- 📂 **目录树** - 左侧边栏查看文件结构，支持新建/重命名/删除
- 📑 **多标签页** - 支持同时打开多个文档
- 💾 **自动保存** - 文档修改自动保存到本地文件
- 🌙 **主题切换** - 亮色/暗色模式
- ⌨️ **快捷键** - 支持 Ctrl+B/I/S 等快捷操作

## 技术栈

| 技术 | 说明 |
|------|------|
| React 18 | 前端框架 |
| TypeScript | 类型安全 |
| Vditor | Markdown 编辑器引擎 |
| TailwindCSS | 样式方案 |
| Zustand | 状态管理 |
| Vite | 构建工具 |
| Lucide React | 图标库 |

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

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建文档 |
| Ctrl+O | 打开文件 |
| Ctrl+S | 保存 |
| Ctrl+B | 加粗 |
| Ctrl+I | 斜体 |
| Ctrl+M | 插入表格 |

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

桌面应用通过 GitHub Actions 自动构建，无需本地安装 Rust 或其他编译工具。

推送代码到 GitHub 后，Actions 会自动打包：
- Windows: `.exe` 安装包
- macOS: `.dmg` 安装包
- Linux: `.AppImage` / `.deb` 安装包

## License

MIT
