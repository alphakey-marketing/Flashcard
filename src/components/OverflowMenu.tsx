import React, { useState, CSSProperties } from 'react';

export interface OverflowMenuItem {
  key: string;
  icon: string;
  label: string;
  description?: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  triggerLabel?: string;
  triggerAriaLabel: string;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({ items, triggerLabel = '⋯', triggerAriaLabel }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: OverflowMenuItem) => {
    if (item.disabled) return;
    setIsOpen(false);
    item.onSelect();
  };

  return (
    <>
      <button
        style={styles.trigger}
        onClick={e => { e.stopPropagation(); setIsOpen(true); }}
        aria-label={triggerAriaLabel}
        title={triggerAriaLabel}
      >
        {triggerLabel}
      </button>

      {isOpen && (
        <div style={styles.overlay} onClick={e => { e.stopPropagation(); setIsOpen(false); }}>
          <div style={styles.sheet} onClick={e => e.stopPropagation()}>
            {items.map(item => (
              <button
                key={item.key}
                style={{ ...styles.item, opacity: item.disabled ? 0.5 : 1, cursor: item.disabled ? 'not-allowed' : 'pointer' }}
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
              >
                <div style={styles.itemIcon}>{item.icon}</div>
                <div style={styles.itemText}>
                  <div style={styles.itemTitle}>{item.label}</div>
                  {item.description && <div style={styles.itemDesc}>{item.description}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const styles: { [key: string]: CSSProperties } = {
  trigger: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: 700,
    color: '#64748b',
    cursor: 'pointer',
    flexShrink: 0,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1100,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: '16px 16px 0 0',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
  },
  item: {
    backgroundColor: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  itemIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '2px',
  },
  itemDesc: {
    fontSize: '12px',
    color: '#64748b',
  },
};

export default OverflowMenu;
