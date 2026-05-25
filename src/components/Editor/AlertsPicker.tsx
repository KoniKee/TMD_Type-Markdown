import React, { useRef, useEffect } from 'react';
import { Info, Lightbulb, CircleAlert, TriangleAlert, OctagonAlert } from 'lucide-react';

interface AlertsPickerProps {
  onSelect: (type: 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION') => void;
  onClose: () => void;
}

const ALERT_TYPES = [
  { type: 'NOTE' as const, icon: Info, color: '#0969DA', label: 'NOTE' },
  { type: 'TIP' as const, icon: Lightbulb, color: '#1A7F37', label: 'TIP' },
  { type: 'IMPORTANT' as const, icon: CircleAlert, color: '#8250DF', label: 'IMPORTANT' },
  { type: 'WARNING' as const, icon: TriangleAlert, color: '#9A6700', label: 'WARNING' },
  { type: 'CAUTION' as const, icon: OctagonAlert, color: '#CF222E', label: 'CAUTION' },
];

const AlertsPicker: React.FC<AlertsPickerProps> = ({ onSelect, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      ref={modalRef}
      className="alerts-picker-modal"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'var(--editor-bg, #fff)',
        border: '1px solid var(--editor-border, #e0e0e0)',
        borderRadius: '12px',
        padding: '16px',
        zIndex: 10000,
        minWidth: '280px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--editor-border, #e0e0e0)',
      }}>
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--editor-text, #333)' }}>
          选择警报类型
        </span>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--editor-text-secondary, #666)',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {ALERT_TYPES.map(({ type, icon: Icon, color, label }) => (
          <button
            key={type}
            onClick={() => {
              onSelect(type);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              transition: 'background-color 0.15s ease',
              textAlign: 'left' as const,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--editor-code-bg, #f5f5f5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Icon size={20} color={color} />
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 500,
              color: 'var(--editor-text, #333)',
            }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AlertsPicker;
