# Typora 风格 Markdown 编辑器 - 设计文档

## 1. 项目概述

本项目旨在复刻一个类似 Typora 的本地 Markdown 编辑器，支持所见即所得的单栏编辑模式，用户输入 Markdown 语法可实时渲染展示，光标移动到对应位置时显示原始语法便于修改。

## 2. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.0 |
| 前端框架 | React | 18 |
| 编辑器引擎 | ProseMirror | 1.x |
| 样式方案 | TailwindCSS | 3.x |
| 状态管理 | Zustand | 4.x |
| 构建工具 | Vite | 5.x |
| 语言 | TypeScript | 5.x |

## 3. 系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri App Window                        │
├───────────────┬──────────────────────────┬──────────────────┤
│               │                          │                  │
│   Sidebar     │      Main Editor         │    Settings      │
│   (目录树)     │   (ProseMirror WYSIWYG)  │    (可选面板)     │
│               │                          │                  │
├───────────────┼──────────────────────────┴──────────────────┤
│               │                                            │
│   文件管理     │              Tab Bar (标签页)               │
│               │                                            │
└───────────────┴────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│   Tauri Core    │            │   Zustand Store │
│   (Rust后端)    │            │   (状态管理)     │
└────────┬────────┘            └─────────────────┘
         │
         ▼
┌─────────────────┐
│   File System   │
│   (本地文件)     │
└─────────────────┘
```

### 3.2 数据流

```
用户输入 → ProseMirror Editor → 解析MD语法 → 更新NodeView渲染
    ↓
光标移动 → 检测Block位置 → 切换显示模式（源码/渲染）
    ↓
文件修改 → 防抖处理 → Tauri IPC → 文件系统写入
    ↓
粘贴图片 → 剪贴板API → 复制到img/ → 插入相对路径
```

## 4. 组件设计

### 4.1 组件树

```
App
├── ThemeProvider (主题上下文)
├── Layout
│   ├── Sidebar
│   │   ├── DirectoryTree (目录树)
│   │   │   ├── TreeNode (递归)
│   │   │   └── ContextMenu (右键菜单)
│   │   └── NewFileButton
│   ├── MainArea
│   │   ├── TabBar
│   │   │   ├── Tab
│   │   │   └── TabCloseButton
│   │   ├── EditorContainer
│   │   │   └── Editor (ProseMirror)
│   │   │       ├── BlockNodeView
│   │   │       ├── ImageNodeView
│   │   │       └── CodeBlockNodeView
│   │   └── StatusBar
│   └── SettingsPanel (可选)
└── Dialog
    ├── ConfirmDialog
    └── InputDialog
```

### 4.2 核心组件职责

| 组件 | 职责 |
|------|------|
| `Editor` | ProseMirror 编辑器封装，管理插件、事件 |
| `BlockNodeView` | Block级渲染，管理编辑/渲染模式切换 |
| `DirectoryTree` | 目录树渲染，文件操作 |
| `TabBar` | 标签页管理，多文档切换 |
| `ThemeProvider` | 主题状态管理 |

## 5. 编辑器核心设计

### 5.1 Typora 风格渲染原理

```
┌─────────────────────────────────────────┐
│  Block 1: Heading "## 标题"             │  ← 失焦状态：渲染为 <h2>标题</h2>
├─────────────────────────────────────────┤
│  Block 2: Paragraph "这是一段文本..."   │  ← 失焦状态：渲染为 <p>这是一段文本...</p>
├─────────────────────────────────────────┤
│  Block 3: List "- 项目1"               │  ← 失焦状态：渲染为 <ul><li>项目1</li></ul>
├─────────────────────────────────────────┤
│  Block 4: Code "```js\nconsole.log()```"│  ← 焦点所在：显示源码编辑
├─────────────────────────────────────────┤
│  Block 5: Image "![alt](img/xxx.png)"  │  ← 失焦状态：渲染为 <img src="xxx.png">
└─────────────────────────────────────────┘
```

**核心逻辑：**
- 使用 ProseMirror 的 `NodeView` 为每个 Block 创建独立的视图
- 每个 NodeView 维护 `editing` 状态
- 焦点进入时切换为编辑模式（显示源码），焦点离开时切换为渲染模式

### 5.2 ProseMirror Schema

```typescript
// 节点类型
- doc          → 文档根节点
- paragraph    → 段落
- heading      → 标题 (level: 1-6)
- blockquote   → 引用
- code_block   → 代码块 (language)
- image        → 图片 (src, alt, title)
- horizontal_rule → 分割线
- list         → 列表 (ordered/bullet/task_list)
- list_item    → 列表项
- table        → 表格
- table_row    → 表格行
- table_cell   → 表格单元格
- text         → 文本
- hard_break   → 换行

// Mark 类型
- strong       → 加粗
- em           → 斜体
- code         → 行内代码
- link         → 链接 (href, title)
- strikethrough → 删除线
```

## 6. 文件系统设计

### 6.1 文件结构

```
工作目录/
├── document.md           ← 当前文档
├── another-doc.md
├── img/                  ← 图片目录（可配置）
│   ├── image-20240101-001.png
│   └── image-20240101-002.jpg
└── folder/
    └── readme.md
```

### 6.2 Tauri Commands (IPC)

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `read_file` | path: string | string | 读取文件内容 |
| `write_file` | path: string, content: string | void | 写入文件 |
| `read_directory` | path: string | DirEntry[] | 读取目录结构 |
| `create_file` | path: string | void | 创建新文件 |
| `create_directory` | path: string | void | 创建目录 |
| `delete_file` | path: string | void | 删除文件/目录 |
| `rename_file` | from: string, to: string | void | 重命名 |
| `copy_image` | src: string, dest: string | string | 复制图片并返回路径 |
| `get_clipboard_image` | - | Uint8Array | 获取剪贴板图片 |
| `open_dialog` | options: DialogOptions | string | 打开文件/目录对话框 |

## 7. 状态管理设计

### 7.1 Zustand Stores

```typescript
// editorStore.ts - 编辑器状态
interface EditorState {
  documents: Map<string, DocumentState>;  // 文档状态映射
  activeDocPath: string | null;           // 当前活动文档
  saveStatus: 'saved' | 'saving' | 'unsaved';
  
  // Actions
  openDocument: (path: string) => void;
  closeDocument: (path: string) => void;
  updateDocument: (path: string, content: string) => void;
  saveDocument: (path: string) => void;
}

// fileStore.ts - 文件系统状态
interface FileState {
  rootPath: string | null;                // 工作目录根路径
  fileTree: TreeNode[];                   // 目录树结构
  
  // Actions
  setRootPath: (path: string) => void;
  refreshTree: () => void;
  createFile: (path: string, name: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (from: string, to: string) => void;
}

// settingsStore.ts - 设置状态
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  imageDirectory: string;                 // 图片目录名称，默认 'img'
  autoSave: boolean;
  autoSaveDelay: number;                  // 自动保存延迟(ms)，默认 1000
  
  // Actions
  setTheme: (theme: string) => void;
  setImageDirectory: (dir: string) => void;
  setAutoSave: (enabled: boolean) => void;
}
```

## 8. 图片处理流程

```
┌──────────────────────┐
│   Ctrl+V 粘贴        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 检测剪贴板内容类型    │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐   ┌────────────┐
│ 图片   │   │ 非图片内容  │
└───┬────┘   └────────────┘
    │
    ▼
┌──────────────────────┐
│ 生成文件名            │
│ image-{date}-{num}.png│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 复制到 img/ 目录      │
│ (Tauri fs API)       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 插入MD语法            │
│ ![alt](img/xxx.png)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ ProseMirror 渲染图片  │
└──────────────────────┘
```

## 9. 主题设计

### 9.1 亮色主题配色

```css
--bg-primary: #ffffff;
--bg-secondary: #f5f5f5;
--text-primary: #333333;
--text-secondary: #666666;
--border-color: #e0e0e0;
--accent-color: #3b82f6;
--code-bg: #f8f8f8;
```

### 9.2 暗色主题配色

```css
--bg-primary: #1e1e1e;
--bg-secondary: #2d2d2d;
--text-primary: #e0e0e0;
--text-secondary: #a0a0a0;
--border-color: #404040;
--accent-color: #60a5fa;
--code-bg: #2d2d2d;
```

## 10. 技术难点与解决方案

| 难点 | 解决方案 |
|------|----------|
| Typora 风格单栏渲染 | ProseMirror NodeView + 块级编辑状态管理 |
| 光标位置切换显示 | 监听 selection 事件，动态切换 NodeView 渲染模式 |
| 图片粘贴处理 | Tauri clipboard API + fs 复制 + 相对路径计算 |
| 目录树性能 | 虚拟滚动 + 懒加载（仅渲染可见节点） |
| 自动保存防抖 | setTimeout/clearTimeout + 状态标记 |
| 多文档管理 | Tab 切换 + 文档状态分离存储 |
