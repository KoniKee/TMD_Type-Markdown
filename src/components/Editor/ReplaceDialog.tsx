import React, { useState, useEffect, useRef, useCallback } from 'react';
import Vditor from 'vditor';

// 扩展Window类型，添加find方法
declare global {
  interface Window {
    find(text: string, caseSensitive?: boolean, backward?: boolean, wrapAround?: boolean, wholeWord?: boolean, searchInFrames?: boolean, showDialog?: boolean): boolean;
  }
}

interface ReplaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vditor: Vditor | null;
}

/**
 * 查找替换弹窗组件
 * 
 * 功能：
 * - 查找：使用浏览器原生window.find()查找并高亮文本
 * - 替换：替换当前选中的文本
 * - 全部替换：替换所有匹配项
 * 
 * 使用浏览器原生查找功能，支持高亮和选中效果
 */
export const ReplaceDialog: React.FC<ReplaceDialogProps> = ({
  isOpen,
  onClose,
  vditor,
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // 弹窗打开时自动聚焦到查找输入框
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
      // 重置状态
      setMatchCount(0);
    }
  }, [isOpen]);

  // 清除所有高亮
  const clearHighlights = useCallback(() => {
    const editorElement = document.querySelector('.vditor-ir .vditor-reset') ||
                        document.querySelector('.vditor-sv .vditor-reset') ||
                        document.querySelector('.vditor-wysiwyg .vditor-reset') ||
                        document.querySelector('.vditor-reset');
    
    if (!editorElement) return;
    
    const highlights = editorElement.querySelectorAll('.find-highlight');
    highlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    
    // 清除选区
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // 清除高亮
        clearHighlights();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, clearHighlights]);

  // 辅助函数：转义正则表达式特殊字符
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  /**
   * 统计匹配数量
   */
  const countMatches = useCallback(() => {
    if (!findText || !vditor) return 0;

    const content = vditor.getValue();
    try {
      const regex = new RegExp(escapeRegExp(findText), 'gi');
      const matches = content.match(regex);
      return matches ? matches.length : 0;
    } catch (error) {
      console.error('查找失败:', error);
      return 0;
    }
  }, [findText, vditor]);

  /**
   * 查找功能 - DOM遍历+高亮方案
   */
  const handleFind = useCallback(() => {
    if (!findText || !vditor) return;

    // 获取编辑器元素
    const editorElement = document.querySelector('.vditor-ir .vditor-reset') ||
                        document.querySelector('.vditor-sv .vditor-reset') ||
                        document.querySelector('.vditor-wysiwyg .vditor-reset') ||
                        document.querySelector('.vditor-reset');
    
    if (!editorElement) {
      alert('无法找到编辑区域');
      return;
    }

    // 清除之前的高亮
    clearHighlights();

    // 查找并高亮所有匹配
    const matches: {node: Text, start: number, end: number}[] = [];
    const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);
    const regex = new RegExp(escapeRegExp(findText), 'gi');
    
    let node;
    while (node = walker.nextNode() as Text) {
      const text = node.textContent || '';
      let match;
      while (match = regex.exec(text)) {
        matches.push({
          node,
          start: match.index,
          end: match.index + findText.length
        });
      }
    }

    setMatchCount(matches.length);
    setCurrentMatch(matches.length > 0 ? 1 : 0);

    if (matches.length === 0) {
      alert('未找到匹配项');
      return;
    }

    // 高亮所有匹配（从后往前，避免索引变化）
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const range = document.createRange();
      range.setStart(match.node, match.start);
      range.setEnd(match.node, match.end);
      
      const span = document.createElement('span');
      span.className = 'find-highlight';
      span.style.backgroundColor = '#ffeb3b';
      span.style.color = '#000';
      span.style.borderRadius = '2px';
      span.dataset.matchIndex = String(i + 1);
      
      range.surroundContents(span);
    }

    // 滚动到第一个匹配
    const firstHighlight = editorElement.querySelector('.find-highlight') as HTMLElement;
    if (firstHighlight) {
      firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstHighlight.style.backgroundColor = '#ff9800'; // 当前匹配用不同颜色
    }
  }, [findText, vditor, clearHighlights]);

  /**
   * 查找下一个 - 滚动到下一个高亮
   */
  const handleFindNext = useCallback(() => {
    if (!findText || matchCount === 0) return;

    // 获取编辑器元素
    const editorElement = document.querySelector('.vditor-ir .vditor-reset') ||
                        document.querySelector('.vditor-sv .vditor-reset') ||
                        document.querySelector('.vditor-wysiwyg .vditor-reset') ||
                        document.querySelector('.vditor-reset');
    
    if (!editorElement) return;

    // 重置所有高亮颜色
    const highlights = editorElement.querySelectorAll('.find-highlight');
    highlights.forEach(el => {
      (el as HTMLElement).style.backgroundColor = '#ffeb3b';
    });

    // 更新计数
    const nextIndex = currentMatch >= matchCount ? 1 : currentMatch + 1;
    setCurrentMatch(nextIndex);

    // 找到并滚动到下一个匹配
    const nextHighlight = editorElement.querySelector(`.find-highlight[data-match-index="${nextIndex}"]`) as HTMLElement;
    if (nextHighlight) {
      nextHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nextHighlight.style.backgroundColor = '#ff9800'; // 当前匹配用不同颜色
    }
  }, [findText, matchCount, currentMatch]);

  /**
   * 替换功能 - 替换当前高亮的文本，然后查找下一个
   */
  const handleReplace = useCallback(() => {
    if (!findText || !vditor) return;

    // 获取编辑器元素
    const editorElement = document.querySelector('.vditor-ir .vditor-reset') ||
                        document.querySelector('.vditor-sv .vditor-reset') ||
                        document.querySelector('.vditor-wysiwyg .vditor-reset') ||
                        document.querySelector('.vditor-reset');
    
    if (!editorElement) return;

    // 找到当前高亮的匹配（橙色背景）
    const currentHighlight = editorElement.querySelector('.find-highlight[style*="rgb(255, 152, 0)"]') ||
                            editorElement.querySelector('.find-highlight[style*="#ff9800"]');
    
    if (currentHighlight) {
      // 创建range选中当前高亮的文本
      const range = document.createRange();
      range.selectNodeContents(currentHighlight);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 使用execCommand替换
        document.execCommand('insertText', false, replaceText);
        
        // 更新匹配数量
        const newCount = matchCount - 1;
        setMatchCount(newCount);
        
        if (newCount > 0) {
          // 重新查找以更新高亮
          setTimeout(() => {
            handleFind();
          }, 50);
        } else {
          setCurrentMatch(0);
        }
      }
    } else {
      // 如果没有当前高亮，先查找
      handleFind();
    }
  }, [findText, replaceText, vditor, matchCount, handleFind]);

  /**
   * 全部替换
   */
  const handleReplaceAll = useCallback(() => {
    if (!findText || !vditor) return;

    const content = vditor.getValue();
    try {
      const regex = new RegExp(escapeRegExp(findText), 'gi');
      const matches = content.match(regex);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        // 执行全部替换
        const newContent = content.replace(regex, replaceText);
        vditor.setValue(newContent);
        
        // 提示替换数量
        alert(`已替换 ${count} 处`);
        
        // 重置状态
        setMatchCount(0);
      } else {
        alert('未找到匹配项');
      }
    } catch (error) {
      console.error('全部替换失败:', error);
    }
  }, [findText, replaceText, vditor]);

  // 输入框回车触发查找下一个
  const handleFindKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (matchCount > 0) {
        handleFindNext();
      } else {
        handleFind();
      }
    }
  };

  // 阻止事件冒泡
  const stopPropagation = (e: React.KeyboardEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0"
        onClick={() => { clearHighlights(); onClose(); }}
      />
      
      {/* 弹窗内容 */}
      <div 
        className="relative bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-xl p-5 min-w-[360px] animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
        onKeyUp={stopPropagation}
        onKeyPress={stopPropagation}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-[var(--editor-text)]">查找和替换</h3>
          <button
            onClick={() => { clearHighlights(); onClose(); }}
            className="p-1 rounded hover:bg-[var(--editor-code-bg)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] transition-colors"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="space-y-4">
          {/* 查找输入框 */}
          <div>
            <label className="block text-sm mb-1.5 text-[var(--editor-text)]">
              查找内容：
            </label>
            <input
              ref={findInputRef}
              type="text"
              value={findText}
              onChange={(e) => {
                setFindText(e.target.value);
                setMatchCount(0);
              }}
              onKeyDown={handleFindKeyDown}
              className="w-full px-3 py-2 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-md text-sm text-[var(--editor-text)] placeholder-[var(--editor-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              placeholder="输入要查找的内容"
            />
            {/* 匹配数量提示 */}
            {matchCount > 0 && (
              <div className="text-xs text-[var(--editor-text-secondary)] mt-1.5 px-1">
                找到 <span className="font-medium text-blue-500">{matchCount}</span> 个匹配项
              </div>
            )}
          </div>
          
          {/* 替换输入框 */}
          <div>
            <label className="block text-sm mb-1.5 text-[var(--editor-text)]">
              替换为：
            </label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={stopPropagation}
              className="w-full px-3 py-2 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-md text-sm text-[var(--editor-text)] placeholder-[var(--editor-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              placeholder="输入替换内容（可为空）"
            />
          </div>
          
          {/* 按钮组 */}
          <div className="flex gap-2 pt-2">
            {/* 查找下一个按钮 */}
            <button
              onClick={matchCount > 0 ? handleFindNext : handleFind}
              disabled={!findText}
              className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {matchCount > 0 ? '查找下一个' : '查找'}
            </button>
            
            {/* 替换按钮 */}
            <button
              onClick={handleReplace}
              disabled={!findText}
              className="flex-1 px-3 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              替换
            </button>
            
            {/* 全部替换按钮 */}
            <button
              onClick={handleReplaceAll}
              disabled={!findText}
              className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-md text-sm font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              全部替换
            </button>
          </div>
        </div>
        
        {/* 快捷键提示 */}
        <div className="mt-4 pt-3 border-t border-[var(--editor-border)] text-xs text-[var(--editor-text-secondary)]">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--editor-code-bg)] border border-[var(--editor-border)] rounded text-[10px]">Enter</kbd> 查找下一个
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--editor-code-bg)] border border-[var(--editor-border)] rounded text-[10px]">Esc</kbd> 关闭
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplaceDialog;
