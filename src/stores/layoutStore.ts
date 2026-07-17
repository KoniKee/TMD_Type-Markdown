import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
  leftSidebarVisible: boolean;
  leftSidebarWidth: number;
  rightSidebarVisible: boolean;
  rightSidebarWidth: number;
  verticalTabWidth: number;

  toggleLeftSidebar: () => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  setLeftSidebarWidth: (width: number) => void;
  toggleRightSidebar: () => void;
  setRightSidebarVisible: (visible: boolean) => void;
  setRightSidebarWidth: (width: number) => void;
  setVerticalTabWidth: (width: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      leftSidebarVisible: true,
      leftSidebarWidth: 260,
      rightSidebarVisible: true,
      rightSidebarWidth: 200,
      verticalTabWidth: 180,

      toggleLeftSidebar: () => set({ leftSidebarVisible: !get().leftSidebarVisible }),
      setLeftSidebarVisible: (visible: boolean) => set({ leftSidebarVisible: visible }),
      setLeftSidebarWidth: (width: number) => set({ leftSidebarWidth: Math.max(180, Math.min(400, width)) }),
      toggleRightSidebar: () => set({ rightSidebarVisible: !get().rightSidebarVisible }),
      setRightSidebarVisible: (visible: boolean) => set({ rightSidebarVisible: visible }),
      setRightSidebarWidth: (width: number) => set({ rightSidebarWidth: Math.max(150, Math.min(400, width)) }),
      setVerticalTabWidth: (width: number) => set({ verticalTabWidth: Math.max(120, Math.min(280, width)) }),
    }),
    { name: 'md-editor-layout' }
  )
);
