# MD Editor - Typora 风格 Markdown 编辑器

一个类似 Typora 的本地 Markdown 编辑器，支持所见即所得的单栏编辑模式。

Markdown的实时渲染基于[Vanessa219/vditor: ♏ 一款浏览器端的 Markdown 编辑器，支持所见即所得（富文本）、即时渲染（类似 Typora）和分屏预览模式](https://github.com/Vanessa219/vditor) 项目搭建（感谢大佬的Markdown实时渲染项目，效果非常接近Typora，再次基础上仅修改了tab代码块，改为2中文缩进，有序列表缩进css渲染成不同序列表示）

## 特性

- ✨ **所见即所得** - 输入 Markdown 语法，实时渲染展示
- 🎯 **三种模式** - 所见即所得，实时渲染（类似Typora），分屏预览（古法md），Ctrl+/ 快速切换实时渲染与预览模式
- 🖼️ **图片粘贴** - Ctrl+V 粘贴图片，自动保存到 img 目录并以相对路径引用图片（可配置目录名）
- 🐙 **Mermaid 图表** - 支持 Mermaid 语法绘制流程图、时序图、甘特图等
- 🌱 **PlantUML 图表** - 支持 PlantUML 语法绘制 UML 类图、时序图等
- 📂 **目录树** - 左侧边栏查看文件结构，支持目录和md文档的新建和重命名
- 📋 **TOC 目录** - 支持 `[toc]` 语法生成文档目录
- 📑 **多标签页** - 支持同时打开多个文档
- 📎 **拖拽打开** - 拖拽 .md 文件到窗口直接打开（拖拽到分栏窗格中在窗格中打开）
- 📝 **扩展语法** - 支持高亮、上标、下标语法
- 😀 **Emoji 表情** - 支持 emoji 表情输入与渲染
- 📊 **字数统计** - 显示渲染文字字数和 Markdown 文本字数
- 📄 **文档嵌入** - 支持在 md 文档中使用`[[显示信息]](xxx.md)` 自定义语法嵌入其他 md 文档并渲染显示
- 💾 **自动保存** - 文档修改自动保存到本地文件，支持保存（快捷键ctrl+s）和另存为（快捷键ctrl+shift+s）
- 🌙 **主题切换** - 亮色/暗色模式
- ⌨️ **快捷键** - 支持 Ctrl+B/I/S 等快捷操作，文本编辑工具条上hover显示快捷键提示
- 🔍 **查找替换** - 支持文档内容查找和替换
- 📌 **最近文件** - 最近打开文件列表，快速访问
- 📐 **分栏显示** - 支持分栏布局（每个tab单独分栏布局），支持快捷键水平（alt+shift+减号）、垂直（alt+shift+加号）分栏，支持快捷键切换分栏（alt+方向键）和关闭分栏（alt+shift+w）窗格。支持从外部、左侧文件目录树中拖拽md文档到窗格中打开。支持调整分栏窗格大小。
- 📏 **大纲调整** - 大纲栏支持拖拽调整大小
- 📖 **页宽设置** - 编辑区域支持全宽、较宽、普通三种宽度设置

## 功能截图

**更新采用更加现代化一体式的UI界面**

![image](img/1779526135134_image.png)



**实时渲染，优化引用**

Markdown语法实时渲染，光标移动到附近显示Markdown源码方便修改，优化引用渲染样式

![PixPin_2026_05_04_00_24_23](img/1777825469467_PixPin_2026_05_04_00_24_23.png)



**支持文档目录树和文档大纲**

左侧可展示文档目录树，支持对目录和md文件的新建和重命名

右侧可展示当前md文档的大纲，点击跳转

![PixPin_2026_05_03_22_48_07](img/1777819721913_PixPin_2026_05_03_22_48_07.png)



**快速贴图**

复制图片，可直接将图片保存到文档同级目录的img目录（可配置修改目录名）下，并使用相对路径在文档中引用图片

![PixPin_2026_05_03_23_13_21](img/1777821204961_PixPin_2026_05_03_23_13_21.png)



**tab键交互，有序列表渲染优化**

优化tab键交互，行首tab键缩进2个汉字，保持表格中tab键跳转到下一单元格，保持列表中tab键缩进层级，优化有序列表缩进层级渲染为不同的序列标识。

![PixPin_2026_05_03_23_17_03](img/1777821429732_PixPin_2026_05_03_23_17_03.png)



**支持明暗两种主题**

![PixPin_2026_05_03_23_20_09](img/1777821614787_PixPin_2026_05_03_23_20_09.png)


**支持toc，高亮，上标，下标**

![image](img/1779525536546_image.png)


**支持mermaid图表、PlantUML图表等**

![image](img/1779525609866_image.png)

![image](img/1779525653904_image.png)


**支持字数统计**

![PixPin_2026_05_23_16_41_16](img/1779525678121_PixPin_2026_05_23_16_41_16.png)


**支持使用自定义语法`[[]]()`在一个md文档中嵌入另一个md文档并预览渲染内容**

![image](img/1779525748965_image.png)

![image](img/1779525763966_image.png)


**支持系统emoji表情（分组），支持查找替换**

![image](img/1779525842453_image.png)

![image](img/1779525881578_image.png)


**支持最近文件列表**

![image](img/1779525930423_image.png)


**支持分栏窗格**

![image](img/1779526005178_image.png)



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
- 引用（支持中文 `》` 作为引用标记）
- GitHub Alerts（NOTE、TIP、IMPORTANT、WARNING、CAUTION）
- 分割线
- 表格
- 脚注
- 高亮（==标记==）
- 上标、下标
- TOC 目录（`[toc]`）
- Mermaid 图表
- PlantUML 图表
- Emoji 表情
- 文档嵌入

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
