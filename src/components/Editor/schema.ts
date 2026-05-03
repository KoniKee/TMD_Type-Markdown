import { Schema, NodeSpec, MarkSpec } from 'prosemirror-model';

// 节点定义
const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'block+'
  },

  paragraph: {
    content: 'inline*',
    group: 'block',
    parseDOM: [{ tag: 'p' }],
    toDOM() { return ['p', 0]; }
  },

  heading: {
    attrs: { level: { default: 1 } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } }
    ],
    toDOM(node) { return [`h${node.attrs.level}`, 0]; }
  },

  blockquote: {
    content: 'block+',
    group: 'block',
    defining: true,
    parseDOM: [{ tag: 'blockquote' }],
    toDOM() { return ['blockquote', 0]; }
  },

  code_block: {
    attrs: { language: { default: '' } },
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    parseDOM: [{
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs(dom: HTMLElement) {
        const code = dom.querySelector('code');
        const classes = code?.className?.split(' ') || [];
        const langClass = classes.find((c: string) => c.startsWith('language-'));
        return {
          language: langClass ? langClass.replace('language-', '') : ''
        };
      }
    }],
    toDOM(node) {
      const lang = node.attrs.language;
      const codeAttrs = lang ? { class: `language-${lang}` } : {};
      return ['pre', ['code', codeAttrs, 0]];
    }
  },

  horizontal_rule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() { return ['hr']; }
  },

  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM() { return ['br']; }
  },

  bullet_list: {
    content: 'list_item+',
    group: 'block',
    parseDOM: [{ tag: 'ul' }],
    toDOM() { return ['ul', 0]; }
  },

  ordered_list: {
    attrs: { order: { default: 1 } },
    content: 'list_item+',
    group: 'block',
    parseDOM: [{
      tag: 'ol',
      getAttrs(dom: HTMLElement) {
        return { order: dom.hasAttribute('start') ? +dom.getAttribute('start')! : 1 };
      }
    }],
    toDOM(node) {
      return node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0];
    }
  },

  list_item: {
    content: 'paragraph block*',
    parseDOM: [{ tag: 'li' }],
    toDOM() { return ['li', 0]; },
    defining: true
  },

  // 表格支持
  table: {
    content: 'table_row+',
    group: 'block',
    parseDOM: [{ tag: 'table' }],
    toDOM() { return ['table', ['tbody', 0]]; }
  },

  table_row: {
    content: 'table_cell+',
    parseDOM: [{ tag: 'tr' }],
    toDOM() { return ['tr', 0]; }
  },

  table_cell: {
    content: 'inline*',
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      alignment: { default: null }
    },
    parseDOM: [{
      tag: 'td',
      getAttrs(dom: HTMLElement) {
        return {
          colspan: +(dom.getAttribute('colspan') || 1),
          rowspan: +(dom.getAttribute('rowspan') || 1),
          alignment: dom.style.textAlign || null
        };
      }
    }, {
      tag: 'th',
      getAttrs(dom: HTMLElement) {
        return {
          colspan: +(dom.getAttribute('colspan') || 1),
          rowspan: +(dom.getAttribute('rowspan') || 1),
          alignment: dom.style.textAlign || null
        };
      }
    }],
    toDOM(node) {
      const attrs: Record<string, any> = {};
      if (node.attrs.alignment) attrs.style = `text-align: ${node.attrs.alignment}`;
      return ['td', attrs, 0];
    }
  },

  image: {
    attrs: {
      src: {},
      alt: { default: '' },
      title: { default: '' }
    },
    group: 'inline',
    inline: true,
    draggable: true,
    parseDOM: [{
      tag: 'img[src]',
      getAttrs(dom: HTMLElement) {
        return {
          src: dom.getAttribute('src'),
          alt: dom.getAttribute('alt') || '',
          title: dom.getAttribute('title') || ''
        };
      }
    }],
    toDOM(node) {
      const { src, alt, title } = node.attrs;
      const attrs: Record<string, string> = { src };
      if (alt) attrs.alt = alt;
      if (title) attrs.title = title;
      return ['img', attrs];
    }
  },

  text: {
    group: 'inline'
  }
};

// 标记定义
const marks: Record<string, MarkSpec> = {
  strong: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (dom: HTMLElement) => dom.style.fontWeight !== 'normal' && null },
      { style: 'font-weight', getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null }
    ],
    toDOM() { return ['strong', 0]; }
  },

  em: {
    parseDOM: [
      { tag: 'i' },
      { tag: 'em' },
      { style: 'font-style=italic' }
    ],
    toDOM() { return ['em', 0]; }
  },

  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM() { return ['code', 0]; }
  },

  link: {
    attrs: {
      href: {},
      title: { default: '' }
    },
    inclusive: false,
    parseDOM: [{
      tag: 'a[href]',
      getAttrs(dom: HTMLElement) {
        return {
          href: dom.getAttribute('href'),
          title: dom.getAttribute('title') || ''
        };
      }
    }],
    toDOM(node) {
      const { href, title } = node.attrs;
      const attrs: Record<string, string> = { href };
      if (title) attrs.title = title;
      return ['a', attrs, 0];
    }
  },

  strikethrough: {
    parseDOM: [
      { tag: 'del' },
      { tag: 's' },
      { tag: 'strike' },
      { style: 'text-decoration=line-through' }
    ],
    toDOM() { return ['del', 0]; }
  }
};

// 创建 Schema
export const markdownSchema = new Schema({ nodes, marks });

export type MarkdownSchema = typeof markdownSchema;
