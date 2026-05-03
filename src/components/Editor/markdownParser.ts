import { Node, Schema } from 'prosemirror-model';
import { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import MarkdownIt from 'markdown-it';

/**
 * Markdown 解析器配置
 */
function createParser(schema: Schema): MarkdownParser {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  
  return new MarkdownParser(
    schema,
    md,
    {
      // 块级节点
      blockquote: { block: 'blockquote' },
      paragraph: { block: 'paragraph' },
      list_item: { block: 'list_item' },
      bullet_list: { block: 'bullet_list' },
      ordered_list: { block: 'ordered_list', getAttrs: (tok: any) => ({ order: +tok.attrGet('start') || 1 }) },
      heading: { block: 'heading', getAttrs: (tok: any) => ({ level: +tok.tag.slice(1) }) },
      code_block: { block: 'code_block' },
      fence: { block: 'code_block', getAttrs: (tok: any) => ({ language: tok.info || '' }) },
      hr: { node: 'horizontal_rule' },
      hardbreak: { node: 'hard_break' },
      softbreak: { node: 'hard_break' },

      // 表格支持
      table: { block: 'table' },
      thead: { ignore: true },
      tbody: { ignore: true },
      tr: { block: 'table_row' },
      td: { block: 'table_cell' },
      th: { block: 'table_cell' },

      // 行内节点
      image: {
        node: 'image',
        getAttrs: (tok: any) => {
          const src = tok.attrGet('src');
          const title = tok.attrGet('title') || '';
          const alt = tok.children?.[0]?.content || '';
          return { src, title, alt };
        }
      },

      // 标记
      em: { mark: 'em' },
      strong: { mark: 'strong' },
      link: {
        mark: 'link',
        getAttrs: (tok: any) => ({
          href: tok.attrGet('href'),
          title: tok.attrGet('title') || ''
        })
      },
      code_inline: { mark: 'code' },
      s: { mark: 'strikethrough' }
    }
  );
}

/**
 * Markdown 序列化器配置
 */
function createSerializer(): MarkdownSerializer {
  return new MarkdownSerializer(
    {
      // 块级节点序列化
      blockquote(state, node) {
        state.wrapBlock('> ', null, node, () => state.renderContent(node));
      },
      code_block(state, node) {
        state.write('```' + (node.attrs.language || '') + '\n');
        state.text(node.textContent, false);
        state.ensureNewLine();
        state.write('```');
        state.closeBlock(node);
      },
      heading(state, node) {
        state.write('#'.repeat(node.attrs.level) + ' ');
        state.renderInline(node);
        state.closeBlock(node);
      },
      horizontal_rule(state, node) {
        state.write('---');
        state.closeBlock(node);
      },
      bullet_list(state, node) {
        state.renderList(node, '  ', () => '- ');
      },
      ordered_list(state, node) {
        const start = node.attrs.order || 1;
        state.renderList(node, '  ', (i: number) => `${start + i}. `);
      },
      list_item(state, node) {
        state.renderContent(node);
      },
      paragraph(state, node) {
        state.renderInline(node);
        state.closeBlock(node);
      },
      table(state, node) {
        // 计算每列的最大宽度
        const colWidths: number[] = [];
        node.forEach((row) => {
          let colIdx = 0;
          row.forEach((cell) => {
            const text = cell.textContent;
            colWidths[colIdx] = Math.max(colWidths[colIdx] || 0, text.length + 2);
            colIdx++;
          });
        });

        // 渲染表头（第一行）
        const firstRow = node.firstChild;
        if (firstRow) {
          state.write('|');
          let colIdx = 0;
          firstRow.forEach((cell) => {
            const text = cell.textContent;
            const width = colWidths[colIdx] || text.length + 2;
            state.write(' ' + text + ' '.repeat(width - text.length - 1) + ' |');
            colIdx++;
          });
          state.ensureNewLine();

          // 渲染分隔线
          state.write('|');
          colWidths.forEach(width => {
            state.write('-'.repeat(width) + '|');
          });
          state.ensureNewLine();
        }

        // 渲染数据行
        let isFirst = true;
        node.forEach((row) => {
          if (isFirst) {
            isFirst = false;
            return;
          }
          state.write('|');
          let colIdx = 0;
          row.forEach((cell) => {
            const text = cell.textContent;
            const width = colWidths[colIdx] || text.length + 2;
            state.write(' ' + text + ' '.repeat(width - text.length - 1) + ' |');
            colIdx++;
          });
          state.ensureNewLine();
        });
        state.closeBlock(node);
      },
      table_row(state, node) {
        state.renderContent(node);
      },
      table_cell(state, node) {
        state.renderInline(node);
      },
      image(state, node) {
        const src = state.esc(node.attrs.src);
        const alt = state.esc(node.attrs.alt || '');
        const title = node.attrs.title ? ` "${state.esc(node.attrs.title)}"` : '';
        state.write(`![${alt}](${src}${title})`);
      },
      hard_break(state, node, parent, index) {
        for (let i = index + 1; i < parent.childCount; i++) {
          if (parent.child(i).type !== node.type) {
            state.write('\\\n');
            return;
          }
        }
      },
      text(state, node) {
        state.text(node.text || '');
      }
    },
    {
      // 标记序列化
      em: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
      strong: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
      code: { open(_state, _mark) { return '`'; }, close(_state, _mark) { return '`'; } },
      link: {
        open(_state, mark) { return '['; },
        close(state, mark) {
          const href = state.esc(mark.attrs.href);
          const title = mark.attrs.title ? ` "${state.esc(mark.attrs.title)}"` : '';
          return `](${href}${title})`;
        }
      },
      strikethrough: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true }
    }
  );
}

/**
 * 解析 Markdown 字符串为 ProseMirror 文档节点
 */
export function parseMarkdown(markdown: string, schema: Schema): Node {
  const parser = createParser(schema);
  return parser.parse(markdown);
}

/**
 * 将 ProseMirror 文档节点序列化为 Markdown 字符串
 */
export function serializeMarkdown(doc: Node): string {
  const serializer = createSerializer();
  return serializer.serialize(doc);
}
