import { create } from 'zustand';

export type SplitDirection = 'horizontal' | 'vertical';

export interface PaneLeaf {
  id: string;
  type: 'leaf';
  docPath: string | null;
}

export interface PaneSplit {
  id: string;
  type: 'split';
  direction: SplitDirection;
  children: [Pane, Pane];
  ratio: number;
}

export type Pane = PaneLeaf | PaneSplit;

export interface TabSplitState {
  tabPath: string;
  paneTree: Pane;
  activePaneId: string;
}

let paneIdCounter = 0;
const generatePaneId = () => `pane-${++paneIdCounter}`;

function createLeafPane(docPath: string | null = null): PaneLeaf {
  return {
    id: generatePaneId(),
    type: 'leaf',
    docPath,
  };
}

function countLeafPanes(pane: Pane): number {
  if (pane.type === 'leaf') return 1;
  return countLeafPanes(pane.children[0]) + countLeafPanes(pane.children[1]);
}

function findPaneById(pane: Pane, id: string): Pane | null {
  if (pane.id === id) return pane;
  if (pane.type === 'split') {
    return findPaneById(pane.children[0], id) || findPaneById(pane.children[1], id);
  }
  return null;
}

function findParentPane(pane: Pane, targetId: string, parent: Pane | null = null): Pane | null {
  if (pane.id === targetId) return parent;
  if (pane.type === 'split') {
    return (
      findParentPane(pane.children[0], targetId, pane) ||
      findParentPane(pane.children[1], targetId, pane)
    );
  }
  return null;
}

function replacePaneInTree(
  pane: Pane,
  targetId: string,
  newPane: Pane
): Pane {
  if (pane.id === targetId) return newPane;
  if (pane.type === 'split') {
    return {
      ...pane,
      children: [
        replacePaneInTree(pane.children[0], targetId, newPane),
        replacePaneInTree(pane.children[1], targetId, newPane),
      ],
    };
  }
  return pane;
}

function removePaneFromTree(
  pane: Pane,
  targetId: string
): Pane | null {
  if (pane.type === 'leaf') {
    return pane.id === targetId ? null : pane;
  }
  
  const left = removePaneFromTree(pane.children[0], targetId);
  const right = removePaneFromTree(pane.children[1], targetId);
  
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  
  return {
    ...pane,
    children: [left, right] as [Pane, Pane],
  };
}

function getAllDocumentsInPanes(pane: Pane): string[] {
  const docs: string[] = [];
  if (pane.type === 'leaf') {
    if (pane.docPath) docs.push(pane.docPath);
  } else {
    docs.push(...getAllDocumentsInPanes(pane.children[0]));
    docs.push(...getAllDocumentsInPanes(pane.children[1]));
  }
  return docs;
}

function getFirstLeafPane(pane: Pane): PaneLeaf {
  if (pane.type === 'leaf') return pane;
  return getFirstLeafPane(pane.children[0]);
}

function getNextPaneInDirection(
  pane: Pane,
  activePaneId: string,
  direction: 'up' | 'down' | 'left' | 'right'
): PaneLeaf | null {
  const leaves: { pane: PaneLeaf; path: { pane: Pane; index: number }[] }[] = [];
  
  function collectLeaves(p: Pane, path: { pane: Pane; index: number }[] = []) {
    if (p.type === 'leaf') {
      leaves.push({ pane: p, path });
    } else {
      collectLeaves(p.children[0], [...path, { pane: p, index: 0 }]);
      collectLeaves(p.children[1], [...path, { pane: p, index: 1 }]);
    }
  }
  
  collectLeaves(pane);
  
  const activeIndex = leaves.findIndex(l => l.pane.id === activePaneId);
  if (activeIndex === -1) return null;
  
  const activeLeaf = leaves[activeIndex];
  
  for (let i = 0; i < leaves.length; i++) {
    if (i === activeIndex) continue;
    const candidate = leaves[i];
    
    if (direction === 'left' || direction === 'right') {
      const activePath = activeLeaf.path;
      const candidatePath = candidate.path;
      
      for (let j = 0; j < Math.min(activePath.length, candidatePath.length); j++) {
        const activeNode = activePath[j];
        const candidateNode = candidatePath[j];
        
        if (activeNode.pane.id !== candidateNode.pane.id) continue;
        
        if (activeNode.pane.type === 'split' && activeNode.pane.direction === 'vertical') {
          if (direction === 'left' && activeNode.index === 1 && candidateNode.index === 0) {
            return candidate.pane;
          }
          if (direction === 'right' && activeNode.index === 0 && candidateNode.index === 1) {
            return candidate.pane;
          }
        }
      }
    }
    
    if (direction === 'up' || direction === 'down') {
      const activePath = activeLeaf.path;
      const candidatePath = candidate.path;
      
      for (let j = 0; j < Math.min(activePath.length, candidatePath.length); j++) {
        const activeNode = activePath[j];
        const candidateNode = candidatePath[j];
        
        if (activeNode.pane.id !== candidateNode.pane.id) continue;
        
        if (activeNode.pane.type === 'split' && activeNode.pane.direction === 'horizontal') {
          if (direction === 'up' && activeNode.index === 1 && candidateNode.index === 0) {
            return candidate.pane;
          }
          if (direction === 'down' && activeNode.index === 0 && candidateNode.index === 1) {
            return candidate.pane;
          }
        }
      }
    }
  }
  
  if (direction === 'left' && activeIndex > 0) return leaves[activeIndex - 1].pane;
  if (direction === 'right' && activeIndex < leaves.length - 1) return leaves[activeIndex + 1].pane;
  if (direction === 'up' && activeIndex > 0) return leaves[activeIndex - 1].pane;
  if (direction === 'down' && activeIndex < leaves.length - 1) return leaves[activeIndex + 1].pane;
  
  return null;
}

interface SplitStore {
  tabSplitStates: Record<string, TabSplitState>;
  maxPanes: number;
  
  getCurrentState: (tabPath: string) => TabSplitState | null;
  getActiveDocPath: (tabPath: string) => string | null;
  getPaneCount: (tabPath: string) => number;
  getDocumentsInPanes: (tabPath: string) => string[];
  
  initTabSplitState: (tabPath: string, docPath: string | null) => void;
  splitPane: (tabPath: string, paneId: string, direction: SplitDirection) => boolean;
  closePane: (tabPath: string, paneId: string) => void;
  setPaneDocument: (tabPath: string, paneId: string, docPath: string | null) => void;
  setActivePane: (tabPath: string, paneId: string) => void;
  setSplitRatio: (tabPath: string, splitPaneId: string, ratio: number) => void;
  cleanupTabSplitState: (tabPath: string) => void;
  focusNextPane: (tabPath: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  canSplit: (tabPath: string) => boolean;
}

export const useSplitStore = create<SplitStore>((set, get) => ({
  tabSplitStates: {},
  maxPanes: 4,
  
  getCurrentState: (tabPath: string) => {
    return get().tabSplitStates[tabPath] || null;
  },
  
  getActiveDocPath: (tabPath: string) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return null;
    const pane = findPaneById(state.paneTree, state.activePaneId);
    if (pane && pane.type === 'leaf') return pane.docPath;
    return null;
  },
  
  getPaneCount: (tabPath: string) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return 0;
    return countLeafPanes(state.paneTree);
  },
  
  getDocumentsInPanes: (tabPath: string) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return [];
    return getAllDocumentsInPanes(state.paneTree);
  },
  
  initTabSplitState: (tabPath: string, docPath: string | null) => {
    const existing = get().tabSplitStates[tabPath];
    if (existing) return;
    
    const leafPane = createLeafPane(docPath);
    set({
      tabSplitStates: {
        ...get().tabSplitStates,
        [tabPath]: {
          tabPath,
          paneTree: leafPane,
          activePaneId: leafPane.id,
        },
      },
    });
  },
  
  splitPane: (tabPath: string, paneId: string, direction: SplitDirection) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return false;
    
    const currentCount = countLeafPanes(state.paneTree);
    if (currentCount >= get().maxPanes) {
      return false;
    }
    
    const targetPane = findPaneById(state.paneTree, paneId);
    if (!targetPane || targetPane.type !== 'leaf') return false;
    
    const newLeafPane = createLeafPane(null);
    const newSplitPane: PaneSplit = {
      id: generatePaneId(),
      type: 'split',
      direction,
      children: direction === 'vertical' 
        ? [targetPane, newLeafPane] 
        : [targetPane, newLeafPane],
      ratio: 0.5,
    };
    
    const newTree = replacePaneInTree(state.paneTree, paneId, newSplitPane);
    
    set({
      tabSplitStates: {
        ...get().tabSplitStates,
        [tabPath]: {
          ...state,
          paneTree: newTree,
          activePaneId: newLeafPane.id,
        },
      },
    });
    
    return true;
  },
  
  closePane: (tabPath: string, paneId: string) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return;
    
    const newTree = removePaneFromTree(state.paneTree, paneId);
    
    if (!newTree) return;
    
    const newActivePane = state.activePaneId === paneId
      ? getFirstLeafPane(newTree).id
      : state.activePaneId;
    
    set({
      tabSplitStates: {
        ...get().tabSplitStates,
        [tabPath]: {
          ...state,
          paneTree: newTree,
          activePaneId: newActivePane,
        },
      },
    });
  },
  
  setPaneDocument: (tabPath: string, paneId: string, docPath: string | null) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return;
    
    const targetPane = findPaneById(state.paneTree, paneId);
    if (!targetPane || targetPane.type !== 'leaf') return;
    
    const newLeafPane: PaneLeaf = { ...targetPane, docPath };
    const newTree = replacePaneInTree(state.paneTree, paneId, newLeafPane);
    
    set({
      tabSplitStates: {
        ...get().tabSplitStates,
        [tabPath]: {
          ...state,
          paneTree: newTree,
        },
      },
    });
  },
  
  setActivePane: (tabPath: string, paneId: string) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return;
    
    const pane = findPaneById(state.paneTree, paneId);
    if (!pane) return;
    
    set({
      tabSplitStates: {
        ...get().tabSplitStates,
        [tabPath]: {
          ...state,
          activePaneId: paneId,
        },
      },
    });
  },
  
  setSplitRatio: (tabPath: string, splitPaneId: string, ratio: number) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return;
    
    const targetPane = findPaneById(state.paneTree, splitPaneId);
    if (!targetPane || targetPane.type !== 'split') return;
    
    const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
    const newSplitPane: PaneSplit = { ...targetPane, ratio: clampedRatio };
    const newTree = replacePaneInTree(state.paneTree, splitPaneId, newSplitPane);
    
    set({
      tabSplitStates: {
        ...get().tabSplitStates,
        [tabPath]: {
          ...state,
          paneTree: newTree,
        },
      },
    });
  },
  
  cleanupTabSplitState: (tabPath: string) => {
    const { [tabPath]: _, ...rest } = get().tabSplitStates;
    set({ tabSplitStates: rest });
  },
  
  focusNextPane: (tabPath: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return;
    
    const nextPane = getNextPaneInDirection(state.paneTree, state.activePaneId, direction);
    if (nextPane) {
      set({
        tabSplitStates: {
          ...get().tabSplitStates,
          [tabPath]: {
            ...state,
            activePaneId: nextPane.id,
          },
        },
      });
    }
  },
  
  canSplit: (tabPath: string) => {
    const state = get().tabSplitStates[tabPath];
    if (!state) return false;
    return countLeafPanes(state.paneTree) < get().maxPanes;
  },
}));
