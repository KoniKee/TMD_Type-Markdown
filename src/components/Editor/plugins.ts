import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands, liftEmptyBlock, splitBlock } from 'prosemirror-commands';
import { inputRules, InputRule, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';
import { Schema, MarkType, NodeType } from 'prosemirror-model';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';

/**
 * 切换mark状态
 */
function toggleMark(markType: MarkType) {
  return (state: any, dispatch: any) => {
    const { selection } = state;
    
    if (selection.empty) {
      const cursor = (selection as TextSelection).$cursor;
      const marks = cursor?.marks() || [];
      const hasMark = marks.some((mark: any) => mark.type === markType);
      
      if (hasMark) {
        const tr = state.tr.removeStoredMark(markType);
        if (dispatch) dispatch(tr);
      } else {
        const tr = state.tr.addStoredMark(markType.create());
        if (dispatch) dispatch(tr);
      }
    } else {
      const tr = state.tr;
      const hasMark = state.doc.rangeHasMark(selection.from, selection.to, markType);
      
      if (hasMark) {
        tr.removeMark(selection.from, selection.to, markType);
      } else {
        tr.addMark(selection.from, selection.to, markType.create());
      }
      
      if (dispatch) dispatch(tr);
    }
    return true;
  };
}

/**
 * 输入规则：标题
 * 输入 # 后跟空格 转换为标题
 */
function headingRule(nodeType: NodeType) {
  return textblockTypeInputRule(
    /^(#{1,6})\s$/,
    nodeType,
    (match) => ({ level: match[1].length })
  );
}

/**
 * 输入规则：引用块
 */
function blockquoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType);
}

/**
 * 输入规则：无序列表
 */
function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType);
}

/**
 * 输入规则：有序列表
 */
function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    (match) => ({ order: parseInt(match[1]) }),
    (match, node) => node.childCount + (parseInt(match[1]) || 1) === parseInt(match[1])
  );
}

/**
 * 输入规则：代码块
 */
function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType);
}

/**
 * 输入规则：加粗
 * 匹配 **text** 
 */
function strongRule(markType: MarkType) {
  return new InputRule(
    /\*\*([^*]+)\*\$/,
    (state, match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      tr.insert(start, state.schema.text(match[1], [markType.create()]));
      // 清除存储的mark，防止后续输入继续应用
      tr.removeStoredMark(markType);
      return tr;
    }
  );
}

/**
 * 输入规则：斜体
 * 匹配 *text*，但不匹配 **text**
 */
function emRule(markType: MarkType) {
  return new InputRule(
    /(?<!\*)\*([^*]+)\*(?!\*)$/,
    (state, match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      tr.insert(start, state.schema.text(match[1], [markType.create()]));
      tr.removeStoredMark(markType);
      return tr;
    }
  );
}

/**
 * 输入规则：删除线
 */
function strikethroughRule(markType: MarkType) {
  return new InputRule(
    /~~([^~]+)~~$/,
    (state, match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      tr.insert(start, state.schema.text(match[1], [markType.create()]));
      tr.removeStoredMark(markType);
      return tr;
    }
  );
}

/**
 * 输入规则：行内代码
 */
function inlineCodeRule(markType: MarkType) {
  return new InputRule(
    /`([^`]+)`$/,
    (state, match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      tr.insert(start, state.schema.text(match[1], [markType.create()]));
      tr.removeStoredMark(markType);
      return tr;
    }
  );
}

/**
 * 输入规则：链接
 * 匹配 [text](url)
 */
function linkRule(markType: MarkType) {
  return new InputRule(
    /\[([^\]]*)\]\(([^)]*)\)$/,
    (state, match, start, end) => {
      const { tr } = state;
      const text = match[1] || '链接';
      const href = match[2] || '#';
      
      tr.delete(start, end);
      const linkMark = markType.create({ href, title: '' });
      tr.insert(start, state.schema.text(text, [linkMark]));
      return tr;
    }
  );
}

/**
 * 输入规则：水平线
 */
function horizontalRuleRule(nodeType: NodeType) {
  return new InputRule(
    /^---$/,
    (state, match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      tr.insert(start, nodeType.create());
      return tr;
    }
  );
}

/**
 * 创建所有输入规则
 */
export function createInputRules(schema: Schema) {
  const rules: InputRule[] = [];

  if (schema.nodes.heading) rules.push(headingRule(schema.nodes.heading));
  if (schema.nodes.blockquote) rules.push(blockquoteRule(schema.nodes.blockquote));
  if (schema.nodes.bullet_list) rules.push(bulletListRule(schema.nodes.bullet_list));
  if (schema.nodes.ordered_list) rules.push(orderedListRule(schema.nodes.ordered_list));
  if (schema.nodes.code_block) rules.push(codeBlockRule(schema.nodes.code_block));
  if (schema.nodes.horizontal_rule) rules.push(horizontalRuleRule(schema.nodes.horizontal_rule));

  if (schema.marks.strong) rules.push(strongRule(schema.marks.strong));
  if (schema.marks.em) rules.push(emRule(schema.marks.em));
  if (schema.marks.strikethrough) rules.push(strikethroughRule(schema.marks.strikethrough));
  if (schema.marks.code) rules.push(inlineCodeRule(schema.marks.code));
  if (schema.marks.link) rules.push(linkRule(schema.marks.link));

  return rules;
}

/**
 * 创建输入规则插件
 */
export function createInputRulesPlugin(schema: Schema) {
  return inputRules({
    rules: createInputRules(schema),
  });
}

/**
 * 创建mark管理插件
 * 在某些情况下清除存储的mark，防止mark"粘连"
 */
function createMarkResetPlugin() {
  return new Plugin({
    key: new PluginKey('markReset'),
    appendTransaction(transactions, oldState, newState) {
      // 如果有新的输入
      const inputTransaction = transactions.find(tr => tr.docChanged);
      if (!inputTransaction) return null;
      
      const { selection } = newState;
      if (!selection.empty) return null;
      
      const cursor = (selection as TextSelection).$cursor;
      if (!cursor) return null;
      
      // 获取刚输入的字符
      const pos = cursor.pos;
      if (pos === 0) return null;
      
      const char = newState.doc.textBetween(pos - 1, pos);
      
      // 如果输入了空格或换行，清除所有存储的mark
      if (char === ' ' || char === '\n') {
        const tr = newState.tr;
        tr.setStoredMarks([]);
        return tr;
      }
      
      return null;
    }
  });
}

/**
 * 创建快捷键插件
 */
export function createKeymapPlugin(schema: Schema) {
  return keymap({
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-`': toggleMark(schema.marks.code),
    'Shift-Mod-s': toggleMark(schema.marks.strikethrough),
  });
}

/**
 * 创建图片粘贴插件
 */
export function createImagePastePlugin() {
  return new Plugin({
    key: new PluginKey('imagePaste'),
    props: {
      handlePaste(view: EditorView, event: ClipboardEvent) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            
            const file = item.getAsFile();
            if (!file) return false;
            
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const { schema } = view.state;
              const imageNode = schema.nodes.image.create({
                src: base64,
                alt: file.name.replace(/\.[^.]+$/, ''),
                title: file.name,
              });
              
              const tr = view.state.tr.replaceSelectionWith(imageNode);
              view.dispatch(tr);
            };
            reader.readAsDataURL(file);
            
            return true;
          }
        }
        
        return false;
      },
      
      handleDrop(view: EditorView, event: DragEvent) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const { schema } = view.state;
              const imageNode = schema.nodes.image.create({
                src: base64,
                alt: file.name.replace(/\.[^.]+$/, ''),
                title: file.name,
              });
              
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (pos) {
                const tr = view.state.tr.insert(pos.pos, imageNode);
                view.dispatch(tr);
              }
            };
            reader.readAsDataURL(file);
            
            return true;
          }
        }
        
        return false;
      },
    },
  });
}

/**
 * 创建空文档占位符插件
 */
export function createPlaceholderPlugin() {
  return new Plugin({
    key: new PluginKey('placeholder'),
    props: {
      decorations(state) {
        const { doc } = state;
        
        if (doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph') {
          const paragraph = doc.firstChild;
          if (paragraph.content.size === 0) {
            const placeholder = document.createElement('span');
            placeholder.classList.add('placeholder');
            placeholder.textContent = '开始输入内容...';
            placeholder.setAttribute('contenteditable', 'false');
            
            const widget = Decoration.widget(0, placeholder);
            return DecorationSet.create(doc, [widget]);
          }
        }
        
        return null;
      },
    },
  });
}

/**
 * 创建所有插件
 */
export function createPlugins(schema: Schema) {
  return [
    createInputRulesPlugin(schema),
    createMarkResetPlugin(),
    createKeymapPlugin(schema),
    keymap(baseKeymap),
    createImagePastePlugin(),
    createPlaceholderPlugin(),
  ];
}

export default createPlugins;
