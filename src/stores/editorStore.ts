import { create } from 'zustand';
import { useRecentFilesStore } from './recentFilesStore';

export type EditorMode = 'ir' | 'sv' | 'wysiwyg';
export type PreviewMode = 'editor' | 'both' | 'preview';

export interface DocumentState {
  content: string;
  isModified: boolean;
  isNewFile: boolean;
  lastSaved: number | null;
  outlineVisible: boolean;
  editorMode: EditorMode;
  scrollPosition: number;
  previewMode: PreviewMode;
  filePath?: string;
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
  activeTabPath: string | null;
  tabs: string[];
  saveStatus: SaveStatus;
  wordCount: number;
  markdownLength: number;

  openDocument: (path: string, content?: string, isNew?: boolean) => void;
  ensureDocument: (path: string, content?: string, isNew?: boolean) => void;
  closeDocument: (path: string) => void;
  updateDocument: (path: string, content: string) => void;
  saveDocument: (path: string, content?: string) => void;
  setActiveDocument: (path: string | null) => void;
  setActiveTab: (path: string | null) => void;
  renameDocument: (oldPath: string, newPath: string) => void;
  setWordCount: (count: number) => void;
  setMarkdownLength: (length: number) => void;
  setOutlineVisible: (path: string, visible: boolean) => void;
  setEditorMode: (path: string, mode: EditorMode) => void;
  setScrollPosition: (path: string, position: number) => void;
  setPreviewMode: (path: string, mode: PreviewMode) => void;
  updateFilePath: (docPath: string, filePath: string) => void;
}

export const useEditorStore = create<EditorStateStore>((set, get) => ({
  documents: initialState.documents,
  activeDocPath: initialState.activeDocPath,
  activeTabPath: initialState.activeDocPath,
  tabs: initialState.tabs,
  saveStatus: 'saved',
  wordCount: 0,
  markdownLength: 0,

  openDocument: (path: string, content?: string, isNew?: boolean) => {
    const { documents, tabs } = get();
    const newTabs = [...tabs];

    if (!documents[path]) {
      set({
        documents: {
          ...documents,
          [path]: {
            content: content || '',
            isModified: isNew || false,
            isNewFile: isNew || false,
            lastSaved: isNew ? null : Date.now(),
            outlineVisible: true,
            editorMode: 'ir',
            scrollPosition: 0,
            previewMode: 'editor',
            filePath: isNew ? undefined : path.replace(/^file:\/\//, ''),
          },
        },
      });
    } else if (content !== undefined) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...documents[path],
            content,
            isModified: isNew || false,
            isNewFile: isNew || false,
            filePath: isNew ? undefined : path.replace(/^file:\/\//, ''),
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
      activeTabPath: path,
      saveStatus: isNew ? 'unsaved' : 'saved',
    });
    
    // 记录到最近文件
    const { addFile } = useRecentFilesStore.getState();
    const fileName = path.split('/').pop()?.split('\\').pop() || path;
    addFile(path, fileName);
  },

  ensureDocument: (path: string, content?: string, isNew?: boolean) => {
    const { documents } = get();

    if (!documents[path]) {
      set({
        documents: {
          ...documents,
          [path]: {
            content: content || '',
            isModified: isNew || false,
            isNewFile: isNew || false,
            lastSaved: isNew ? null : Date.now(),
            outlineVisible: true,
            editorMode: 'ir',
            scrollPosition: 0,
            previewMode: 'editor',
            filePath: isNew ? undefined : path.replace(/^file:\/\//, ''),
          },
        },
      });
    } else if (content !== undefined) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...documents[path],
            content,
            isModified: isNew || false,
            isNewFile: isNew || false,
            filePath: isNew ? undefined : path.replace(/^file:\/\//, ''),
          },
        },
      });
    }
    
    // 记录到最近文件
    const { addFile } = useRecentFilesStore.getState();
    const fileName = path.split('/').pop()?.split('\\').pop() || path;
    addFile(path, fileName);
  },

  closeDocument: (path: string) => {
    const { documents, tabs, activeDocPath, activeTabPath } = get();
    const newTabs = tabs.filter((t) => t !== path);
    const { [path]: _, ...restDocs } = documents;

    let newActivePath = activeDocPath;
    let newActiveTabPath = activeTabPath;
    if (activeDocPath === path) {
      const currentIndex = tabs.indexOf(path);
      if (newTabs.length > 0) {
        newActivePath = newTabs[Math.min(currentIndex, newTabs.length - 1)];
      } else {
        newActivePath = null;
      }
    }
    if (activeTabPath === path) {
      newActiveTabPath = newActivePath;
    }

    set({
      documents: restDocs,
      tabs: newTabs,
      activeDocPath: newActivePath,
      activeTabPath: newActiveTabPath,
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

  setActiveDocument: (path: string | null) => set({ activeDocPath: path, activeTabPath: path }),
  
  setActiveTab: (path: string | null) => set({ activeTabPath: path }),

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

  setWordCount: (count: number) => set({ wordCount: count }),
  setMarkdownLength: (length: number) => set({ markdownLength: length }),
  
  setOutlineVisible: (path: string, visible: boolean) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...doc,
            outlineVisible: visible,
          },
        },
      });
    }
  },
  
  setEditorMode: (path: string, mode: EditorMode) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...doc,
            editorMode: mode,
          },
        },
      });
    }
  },
  
  setScrollPosition: (path: string, position: number) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...doc,
            scrollPosition: position,
          },
        },
      });
    }
  },
  
  setPreviewMode: (path: string, mode: PreviewMode) => {
    const { documents } = get();
    const doc = documents[path];
    if (doc) {
      set({
        documents: {
          ...documents,
          [path]: {
            ...doc,
            previewMode: mode,
          },
        },
      });
    }
  },
  
  updateFilePath: (docPath: string, filePath: string) => {
    const { documents } = get();
    set({
      documents: {
        ...documents,
        [docPath]: {
          ...documents[docPath],
          filePath,
          isNewFile: false,
        },
      },
    });
  },
}));
