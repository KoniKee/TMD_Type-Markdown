const FOLD_ICON_CLASS = 'heading-fold-icon';
const FOLD_STATE_ATTR = 'data-fold-state';
const FOLDED_ATTR = 'data-heading-folded';

interface FoldState {
  isFolded: boolean;
}

const foldStates = new Map<string, FoldState>();

let mutationObserver: MutationObserver | null = null;
let refreshTimer: number | null = null;
let currentEditorElement: HTMLElement | null = null;
let toolbarMousedownHandler: ((e: MouseEvent) => void) | null = null;

function getHeadingLevel(element: Element): number {
  const tagName = element.tagName.toLowerCase();
  if (tagName.match(/^h[1-6]$/)) {
    return parseInt(tagName[1]);
  }
  return 0;
}

function isHeadingElement(element: Element): boolean {
  return getHeadingLevel(element) > 0;
}

function getCleanText(heading: Element): string {
  let text = '';
  heading.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (el.classList.contains(FOLD_ICON_CLASS)) return;
      if (el.classList.contains('vditor-ir__marker')) return;
      if (el.classList.contains('vditor-ir__marker--heading')) return;
      if (el.classList.contains('vditor-wysiwyg__marker')) return;
      text += el.textContent || '';
    }
  });
  return text.replace(/\s+/g, ' ').trim();
}

function getHeadingKey(heading: Element): string {
  const level = getHeadingLevel(heading);
  const text = getCleanText(heading).slice(0, 30);
  return `h${level}:${text}`;
}

function getEditorContent(editorElement: HTMLElement): HTMLElement | null {
  return editorElement.querySelector('.vditor-ir .vditor-reset') as HTMLElement
    || editorElement.querySelector('.vditor-wysiwyg .vditor-reset') as HTMLElement;
}

function getFoldableContent(heading: Element, editorContent: Element): Element[] {
  const level = getHeadingLevel(heading);
  if (level === 0) return [];

  const content: Element[] = [];
  let sibling = heading.nextElementSibling;

  while (sibling) {
    if (isHeadingElement(sibling) && getHeadingLevel(sibling) <= level) {
      break;
    }
    content.push(sibling);
    sibling = sibling.nextElementSibling;
  }

  return content;
}

function hasFoldableContent(heading: Element, editorContent: Element): boolean {
  return getFoldableContent(heading, editorContent).length > 0;
}

function toggleFold(heading: HTMLElement, editorContent: Element): void {
  const key = getHeadingKey(heading);
  const content = getFoldableContent(heading, editorContent);

  const state = foldStates.get(key);
  if (state && state.isFolded) {
    content.forEach(el => el.removeAttribute(FOLDED_ATTR));
    foldStates.set(key, { isFolded: false });
  } else {
    content.forEach(el => el.setAttribute(FOLDED_ATTR, 'true'));
    foldStates.set(key, { isFolded: true });
  }
}

function createIconElement(heading: HTMLElement, editorContent: Element): HTMLElement {
  const level = getHeadingLevel(heading);
  const icon = document.createElement('span');
  icon.className = FOLD_ICON_CLASS;
  icon.setAttribute('contenteditable', 'false');
  icon.setAttribute(FOLD_STATE_ATTR, 'expanded');
  icon.title = `H${level} 折叠`;

  icon.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFold(heading, editorContent);
    const state = foldStates.get(getHeadingKey(heading));
    if (state && state.isFolded) {
      icon.setAttribute(FOLD_STATE_ATTR, 'collapsed');
    } else {
      icon.setAttribute(FOLD_STATE_ATTR, 'expanded');
    }
  });

  return icon;
}

function insertIcons(editorContent: HTMLElement): void {
  const headings = editorContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach((heading) => {
    const h = heading as HTMLElement;
    if (!hasFoldableContent(h, editorContent)) return;

    const existingIcon = h.querySelector(`:scope > .${FOLD_ICON_CLASS}`);
    if (existingIcon) return;

    const key = getHeadingKey(h);
    const icon = createIconElement(h, editorContent);

    const state = foldStates.get(key);
    if (state?.isFolded) {
      icon.setAttribute(FOLD_STATE_ATTR, 'collapsed');
      const content = getFoldableContent(h, editorContent);
      content.forEach(el => el.setAttribute(FOLDED_ATTR, 'true'));
    }

    h.insertBefore(icon, h.firstChild);
  });
}

function removeIcons(editorContent: HTMLElement): void {
  const icons = editorContent.querySelectorAll(`.${FOLD_ICON_CLASS}`);
  icons.forEach((icon) => {
    const heading = icon.parentElement;
    icon.remove();
    if (heading) {
      const key = getHeadingKey(heading);
      const state = foldStates.get(key);
      if (state?.isFolded) {
        const content = getFoldableContent(heading, editorContent);
        content.forEach(el => el.setAttribute(FOLDED_ATTR, 'true'));
      }
    }
  });
}

function setupListeners(editorElement: HTMLElement): void {
  const editorContent = getEditorContent(editorElement);
  if (!editorContent) return;

  toolbarMousedownHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const toolbar = editorElement.querySelector('.vditor-toolbar');
    if (toolbar && toolbar.contains(target)) {
      removeIcons(editorContent);
    }
  };
  editorElement.addEventListener('mousedown', toolbarMousedownHandler, true);

  mutationObserver = new MutationObserver(() => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (currentEditorElement) {
        const content = getEditorContent(currentEditorElement);
        if (content) insertIcons(content);
      }
    }, 100);
  });
  mutationObserver.observe(editorContent, { childList: true, subtree: true });
}

export function initHeadingFolding(editorElement: HTMLElement): void {
  currentEditorElement = editorElement;
  const editorContent = getEditorContent(editorElement);
  if (!editorContent) return;

  removeIcons(editorContent);
  insertIcons(editorContent);
  setupListeners(editorElement);
}

export function refreshHeadingFolding(editorElement: HTMLElement): void {
  currentEditorElement = editorElement;
  const editorContent = getEditorContent(editorElement);
  if (!editorContent) return;

  removeIcons(editorContent);
  insertIcons(editorContent);
}

export function destroyHeadingFolding(editorElement: HTMLElement): void {
  currentEditorElement = null;

  if (toolbarMousedownHandler) {
    editorElement.removeEventListener('mousedown', toolbarMousedownHandler, true);
    toolbarMousedownHandler = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const editorContent = getEditorContent(editorElement);
  if (editorContent) {
    editorContent.querySelectorAll(`.${FOLD_ICON_CLASS}`).forEach((icon) => {
      icon.remove();
    });
    editorContent.querySelectorAll(`[${FOLDED_ATTR}]`).forEach((el) => {
      el.removeAttribute(FOLDED_ATTR);
    });
  }
}
