# Markdown 编辑器组件

基于 ProseMirror 的 Typora 风格 Markdown 编辑器。

## 组件结构

### 1. Editor.tsx - 主编辑器组件
- 封装 ProseMirror 的 React 组件
- 使用 useRef 管理编辑器 DOM
- 使用 useEffect 初始化 ProseMirror EditorView
- 支持传入 path 参数标识当前文档
- 内容变化时调用 updateDocument 更新 store
- 处理图片粘贴事件

### 2. EditorContainer.tsx - 编辑器容器
- 从 useEditorStore 获取 activeDocPath
- 没有文档时显示欢迎界面
- 有文档时渲染 Editor 组件

### 3. nodeViews.ts - Typora 风格 NodeView
- 实现单栏编辑模式
- BlockNodeView: 基础块级节点视图
- 支持 editing 状态切换
- 光标所在 Block 显示可编辑源码
- 其他 Block 显示渲染结果

### 4. plugins.ts - 编辑器插件
- createKeymapPlugin: 快捷键(Ctrl+B/I/S)
- createImagePastePlugin: 图片粘贴处理
- createPlaceholderPlugin: 空文档占位符

## 使用方法

```tsx
import { EditorContainer } from './components/Editor'

function App() {
  return (
    <div className="app">
      <EditorContainer />
    </div>
  )
}
```

## 快捷键

- `Ctrl+B`: 加粗
- `Ctrl+I`: 斜体
- `Ctrl+``: 行内代码
- `Ctrl+S`: 保存（需要自定义实现）

## 特性

1. **Typora 风格编辑体验**
   - 所见即所得
   - 实时渲染
   - 单栏编辑模式

2. **图片支持**
   - 粘贴图片（自动转 base64）
   - 拖放图片上传

3. **Markdown 语法支持**
   - 标题 (h1-h6)
   - 段落
   - 列表（有序/无序）
   - 引用
   - 代码块
   - 链接
   - 图片
   - 粗体/斜体/删除线
   - 行内代码

4. **状态管理**
   - 文档状态持久化
   - 编辑器状态保存
   - 多文档标签页支持

## 依赖

- react
- prosemirror-view
- prosemirror-state
- prosemirror-model
- prosemirror-keymap
- prosemirror-commands
- zustand (状态管理)

## 样式

编辑器样式在 `styles.css` 中定义，包含：
- 编辑器容器样式
- 块级节点样式
- Typora 风格的视觉反馈
- 响应式布局

## 扩展

可以通过以下方式扩展编辑器：

1. **添加新的节点类型**
   - 在 schema.ts 中定义新节点
   - 在 nodeViews.ts 中创建对应的 NodeView
   - 在 plugins.ts 中添加快捷键支持

2. **自定义插件**
   - 创建新的 Plugin 实例
   - 添加到 createPlugins() 函数中

3. **图片上传**
   - 修改 createImagePastePlugin
   - 集成图片上传服务

## 注意事项

1. 编辑器使用 ProseMirror 的 Schema 定义文档结构
2. Markdown 解析和序列化使用 prosemirror-markdown
3. 状态管理使用 zustand
4. 所有组件都使用 TypeScript 编写，确保类型安全