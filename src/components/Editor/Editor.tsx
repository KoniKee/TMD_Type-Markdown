import React, { useRef, useEffect, useCallback } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEditorStore } from '../../stores';
import { markdownSchema } from './schema';
import { parseMarkdown, serializeMarkdown } from './markdownParser';
import { createPlugins } from './plugins';
import { createNodeViews } from './nodeViews';
import { useSaveToFile } from '../../hooks/useAutoSave';
import './styles.css';

interface EditorProps {
  path: string;
}

export const Editor: React.FC<EditorProps> = ({ path }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { updateDocument, setEditorState, getEditorState } = useEditorStore();
  const saveToFile = useSaveToFile();

  // 初始化编辑器
  useEffect(() => {
    if (!editorRef.current) return;

    const doc = useEditorStore.getState().documents[path];
    if (!doc) return;

    // 销毁旧的视图
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // 清空DOM
    editorRef.current.innerHTML = '';

    try {
      const savedState = getEditorState(path);
      
      let state: EditorState;
      
      if (savedState) {
        state = savedState;
      } else {
        let content = doc.content || '';
        if (!content.trim()) {
          content = '';
        }
        
        const docNode = parseMarkdown(content, markdownSchema);
        state = EditorState.create({
          doc: docNode,
          plugins: createPlugins(markdownSchema),
        });
      }

      const view = new EditorView(editorRef.current, {
        state,
        nodeViews: createNodeViews(),
        dispatchTransaction(tr) {
          const newState = view.state.apply(tr);
          view.updateState(newState);
          
          setEditorState(path, newState);
          
          if (tr.docChanged) {
            const newContent = serializeMarkdown(newState.doc);
            updateDocument(path, newContent);
          }
        },
        handleKeyDown(_view, event) {
          // Ctrl+S 保存
          if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            saveToFile();
            return true;
          }
          
          // Tab 键处理 - 用于列表缩进
          if (event.key === 'Tab') {
            const { state } = view;
            const { selection } = state;
            const { $from } = selection;
            
            // 检查是否在列表项中
            const listItem = state.schema.nodes.list_item;
            if (listItem) {
              const listItemNode = $from.node(-1);
              if (listItemNode && listItemNode.type === listItem) {
                event.preventDefault();
                // 这里可以添加列表缩进逻辑
                return true;
              }
            }
          }
          
          return false;
        },
      });

      viewRef.current = view;
    } catch (error) {
      console.error('Editor initialization error:', error);
      if (editorRef.current) {
        editorRef.current.innerHTML = `
          <div style="padding: 20px; color: #dc3545;">
            <h3>文档加载失败</h3>
            <p>错误信息: ${error instanceof Error ? error.message : '未知错误'}</p>
            <p>请尝试重新打开文件</p>
          </div>
        `;
      }
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  // 处理图片粘贴
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && viewRef.current) {
          const reader = new FileReader();
          reader.onload = () => {
            if (viewRef.current) {
              const base64 = reader.result as string;
              const { schema } = viewRef.current.state;
              const imageNode = schema.nodes.image.create({
                src: base64,
                alt: file.name.replace(/\.[^.]+$/, ''),
                title: file.name,
              });
              const tr = viewRef.current.state.tr.replaceSelectionWith(imageNode);
              viewRef.current.dispatch(tr);
            }
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, []);

  // 处理拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          if (viewRef.current) {
            const base64 = reader.result as string;
            const { schema } = viewRef.current.state;
            const imageNode = schema.nodes.image.create({
              src: base64,
              alt: file.name.replace(/\.[^.]+$/, ''),
              title: file.name,
            });
            
            const pos = viewRef.current.posAtCoords({ 
              left: e.clientX, 
              top: e.clientY 
            });
            
            if (pos) {
              const tr = viewRef.current.state.tr.insert(pos.pos, imageNode);
              viewRef.current.dispatch(tr);
            }
          }
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
        e.preventDefault();
        const editorStore = useEditorStore.getState();
        file.text().then(content => {
          editorStore.openDocument(`file://${file.name}`, content, false);
        });
      }
    }
  }, []);

  return (
    <div
      ref={editorRef}
      className="editor-content"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    />
  );
};

export default Editor;
