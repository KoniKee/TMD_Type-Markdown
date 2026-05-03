import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView, Decoration, DecorationSource } from 'prosemirror-view';

/**
 * 图片节点视图
 * 支持图片预览和错误处理
 */
export class ImageView implements NodeView {
  dom: HTMLImageElement;
  private node: ProseMirrorNode;

  constructor(node: ProseMirrorNode, _view: EditorView, _getPos: () => number | undefined) {
    this.node = node;
    this.dom = document.createElement('img');
    this.updateNode(node);
    
    // 错误处理
    this.dom.onerror = () => {
      this.dom.style.border = '1px dashed #ccc';
      this.dom.style.padding = '20px';
      this.dom.alt = '图片加载失败';
    };
  }

  private updateNode(node: ProseMirrorNode) {
    const { src, alt, title } = node.attrs;
    this.dom.src = src || '';
    this.dom.alt = alt || '';
    this.dom.title = title || '';
    this.dom.style.maxWidth = '100%';
    this.dom.style.height = 'auto';
    this.dom.style.borderRadius = '4px';
    this.dom.style.cursor = 'pointer';
  }

  update(node: ProseMirrorNode, _decorations: readonly Decoration[], _innerDecorations: DecorationSource) {
    if (node.type.name !== 'image') return false;
    this.node = node;
    this.updateNode(node);
    return true;
  }

  stopEvent(event: Event) {
    // 阻止图片的拖拽，避免与编辑器拖拽冲突
    if (event.type === 'dragstart') return true;
    return false;
  }
}

/**
 * 创建节点视图映射
 * 只为需要特殊处理的节点创建自定义视图
 */
export function createNodeViews() {
  return {
    image: (node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => 
      new ImageView(node, view, getPos),
  };
}

export default createNodeViews;
