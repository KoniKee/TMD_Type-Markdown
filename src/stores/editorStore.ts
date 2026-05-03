import { create } from 'zustand';
import type { EditorState } from 'prosemirror-state';

export interface DocumentState {
  content: string;
  isModified: boolean;
  isNewFile: boolean;
  lastSaved: number | null;
  editorState?: EditorState;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved';

const STORAGE_KEY_DOCS = 'md-editor-docs';
const STORAGE_KEY_TABS = 'md-editor-tabs';
const STORAGE_KEY_ACTIVE_PATH = 'md-editor-active-path';

// 从 localStorage 恢复数据
function loadFromStorage(): { documents: Record<string, DocumentState>; tabs: string[]; activeDocPath: string | null } {
  try {
    const savedDocs = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
    const savedTabs = JSON.parse(localStorage.getItem(STORAGE_KEY_TABS) || '[]');
    const savedActivePath = localStorage.getItem(STORAGE_KEY_ACTIVE_PATH);
    
    const documents: Record<string, DocumentState> = {};
    
    // 不再自动恢复任何文档，让用户手动打开文件
    // 清理所有旧数据
    localStorage.removeItem(STORAGE_KEY_DOCS);
    localStorage.removeItem(STORAGE_KEY_TABS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PATH);
    
    console.log('[EditorStore] 已清理旧的缓存数据');
    
    return { documents, tabs: [], activeDocPath: null };
  } catch (e) {
    console.error('[EditorStore] 恢复数据失败:', e);
    localStorage.removeItem(STORAGE_KEY_DOCS);
    localStorage.removeItem(STORAGE_KEY_TABS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PATH);
    return { documents: {}, tabs: [], activeDocPath: null };
  }
}

// 获取localStorage中保存的文档内容
export function getSavedContent(path: string): { content: string; timestamp: number } | null {
  try {
    const savedDocs = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
    return savedDocs[path] || null;
  } catch {
    return null;
  }
}

const initialState = loadFromStorage();

interface EditorStateStore {
  documents: Record<string, DocumentState>;
  activeDocPath: string | null;
  tabs: string[];
  saveStatus: SaveStatus;

  openDocument: (path: string, content?: string, isNew?: boolean) => void;
  closeDocument: (path: string) => void;
  updateDocument: (path: string, content: string) => void;
  saveDocument: (path: string, content?: string) => void;
  setActiveDocument: (path: string | null) => void;
  setEditorState: (path: string, state: EditorState) => void;
  getEditorState: (path: string) => EditorState | undefined;
  renameDocument: (oldPath: string, newPath: string) => void;
}

export const useEditorStore = create<EditorStateStore>((set, get) => ({
  documents: initialState.documents,
  activeDocPath: initialState.activeDocPath,
  tabs: initialState.tabs,
  saveStatus: 'saved',

  openDocument: (path: string, content?: string, isNew?: boolean) => {
    const { documents, tabs } = get();
    const newTabs = [...tabs];

    // 如果文档不存在，创建新文档状态；如果存在且提供了内容，更新内容
    if (!documents[path]) {
      set({
        documents: {
          ...documents,
          [path]: {
            content: content || '',
            isModified: isNew || false,
            isNewFile: isNew || false,
            lastSaved: isNew ? null : Date.now(),
          },
        },
      });
    } else if (content !== undefined) {
      // 文档已存在但提供了新内容，更新内容
      set({
        documents: {
          ...documents,
          [path]: {
            ...documents[path],
            content,
            isModified: isNew || false,
            isNewFile: isNew || false,
          },
        },
      });
    }

    if (!newTabs.includes(path)) {
      newTabs.push(path);
    }

    set({
      tabs: newTabs,
      activeDocPath: path,
      saveStatus: isNew ? 'unsaved' : 'saved',
    });
  },

  closeDocument: (path: string) => {
    const { documents, tabs, activeDocPath } = get();
    const newTabs = tabs.filter((t) => t !== path);
    const { [path]: _, ...restDocs } = documents;

    let newActivePath = activeDocPath;
    if (activeDocPath === path) {
      const currentIndex = tabs.indexOf(path);
      if (newTabs.length > 0) {
        newActivePath = newTabs[Math.min(currentIndex, newTabs.length - 1)];
      } else {
        newActivePath = null;
      }
    }

    set({
      documents: restDocs,
      tabs: newTabs,
      activeDocPath: newActivePath,
    });
  },

  updateDocument: (path: string, content: string) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...doc,
            content,
            isModified: true,
          },
        },
        saveStatus: 'unsaved',
      });
    }
  },

  saveDocument: (path: string, content?: string) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...doc,
            content: content ?? doc.content,
            isModified: false,
            isNewFile: false,
            lastSaved: Date.now(),
          },
        },
        saveStatus: 'saved',
      });
    }
  },

  setActiveDocument: (path: string | null) => set({ activeDocPath: path }),

  setEditorState: (path: string, state: EditorState) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: { ...doc, editorState: state },
        },
      });
    }
  },

  getEditorState: (path: string) => {
    return get().documents[path]?.editorState;
  },

  renameDocument: (oldPath: string, newPath: string) => {
    const { documents, tabs, activeDocPath } = get();
    const doc = documents[oldPath];
    if (!doc) return;

    const { [oldPath]: _, ...restDocs } = documents;
    const newTabs = tabs.map(t => t === oldPath ? newPath : t);
    const newActivePath = activeDocPath === oldPath ? newPath : activeDocPath;

    set({
      documents: {
        ...restDocs,
        [newPath]: doc,
      },
      tabs: newTabs,
      activeDocPath: newActivePath,
    });
  },
}));
