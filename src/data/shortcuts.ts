export interface ShortcutItem {
  id: string;
  defaultKey: string;
  label: string;
  category: string;
  customizable: boolean;
}

export interface ShortcutCategory {
  id: string;
  label: string;
  items: ShortcutItem[];
}

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'file',
    label: '文件操作',
    items: [
      { id: 'save', defaultKey: 'Ctrl+S', label: '保存文件', category: 'file', customizable: true },
      { id: 'saveAs', defaultKey: 'Ctrl+Shift+S', label: '另存为', category: 'file', customizable: true },
      { id: 'closeDoc', defaultKey: 'Ctrl+W', label: '关闭文档', category: 'file', customizable: true },
    ],
  },
  {
    id: 'edit-vditor',
    label: '编辑操作（Vditor内置）',
    items: [
      { id: 'vd_bold', defaultKey: 'Ctrl+B', label: '加粗', category: 'edit-vditor', customizable: false },
      { id: 'vd_italic', defaultKey: 'Ctrl+I', label: '斜体', category: 'edit-vditor', customizable: false },
      { id: 'vd_strike', defaultKey: 'Ctrl+D', label: '删除线', category: 'edit-vditor', customizable: false },
      { id: 'vd_link', defaultKey: 'Ctrl+K', label: '链接', category: 'edit-vditor', customizable: false },
      { id: 'vd_inlineCode', defaultKey: 'Ctrl+`', label: '行内代码', category: 'edit-vditor', customizable: false },
    ],
  },
  {
    id: 'edit-custom',
    label: '编辑操作（自定义）',
    items: [
      { id: 'findReplace', defaultKey: 'Ctrl+H', label: '查找替换', category: 'edit-custom', customizable: true },
      { id: 'modeSwitch', defaultKey: 'Ctrl+/', label: '切换IR/SV模式', category: 'edit-custom', customizable: true },
      { id: 'alerts', defaultKey: 'Ctrl+Shift+A', label: '插入Alert', category: 'edit-custom', customizable: true },
    ],
  },
  {
    id: 'heading',
    label: '标题',
    items: [
      { id: 'vd_h1', defaultKey: 'Ctrl+1', label: '一级标题', category: 'heading', customizable: false },
      { id: 'vd_h2', defaultKey: 'Ctrl+2', label: '二级标题', category: 'heading', customizable: false },
      { id: 'vd_h3', defaultKey: 'Ctrl+3', label: '三级标题', category: 'heading', customizable: false },
      { id: 'vd_h4', defaultKey: 'Ctrl+4', label: '四级标题', category: 'heading', customizable: false },
      { id: 'vd_h5', defaultKey: 'Ctrl+5', label: '五级标题', category: 'heading', customizable: false },
      { id: 'vd_h6', defaultKey: 'Ctrl+6', label: '六级标题', category: 'heading', customizable: false },
    ],
  },
  {
    id: 'list',
    label: '列表',
    items: [
      { id: 'vd_line', defaultKey: 'Ctrl+L', label: '行', category: 'list', customizable: false },
      { id: 'vd_ordered', defaultKey: 'Ctrl+O', label: '有序列表', category: 'list', customizable: false },
      { id: 'vd_unordered', defaultKey: 'Ctrl+U', label: '无序列表', category: 'list', customizable: false },
    ],
  },
  {
    id: 'table',
    label: '表格',
    items: [
      { id: 'vd_table', defaultKey: 'Ctrl+M', label: '插入表格', category: 'table', customizable: false },
      { id: 'vd_addRow', defaultKey: 'Ctrl+=', label: '添加行', category: 'table', customizable: false },
      { id: 'vd_delRow', defaultKey: 'Ctrl+-', label: '删除行', category: 'table', customizable: false },
      { id: 'vd_addCol', defaultKey: 'Ctrl+Shift+=', label: '添加列', category: 'table', customizable: false },
      { id: 'vd_nextCell', defaultKey: 'Tab', label: '下一单元格', category: 'table', customizable: false },
    ],
  },
  {
    id: 'split',
    label: '分栏操作',
    items: [
      { id: 'splitVertical', defaultKey: 'Alt+Shift++', label: '垂直分栏', category: 'split', customizable: true },
      { id: 'splitHorizontal', defaultKey: 'Alt+Shift+-', label: '水平分栏', category: 'split', customizable: true },
      { id: 'closePane', defaultKey: 'Alt+Shift+W', label: '关闭窗格', category: 'split', customizable: true },
      { id: 'switchPaneFocus', defaultKey: 'Alt+方向键', label: '切换窗格焦点', category: 'split', customizable: true },
    ],
  },
  {
    id: 'undo-redo',
    label: '撤销重做',
    items: [
      { id: 'vd_undo', defaultKey: 'Ctrl+Z', label: '撤销', category: 'undo-redo', customizable: false },
      { id: 'vd_redo', defaultKey: 'Ctrl+Shift+Z', label: '重做', category: 'undo-redo', customizable: false },
    ],
  },
];
