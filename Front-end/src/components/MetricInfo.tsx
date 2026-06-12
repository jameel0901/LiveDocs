import React, { useState, useRef, useEffect } from 'react';

interface MetricInfoProps {
  label: string;
  definition: string;
}

const MetricInfo: React.FC<MetricInfoProps> = ({ label, definition }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <div className={`metric-info${open ? ' metric-info--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="metric-info__btn"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
      >
        i
      </button>
      {open && (
        <>
          <button
            type="button"
            className="metric-info__backdrop"
            aria-label="Close metric info"
            onClick={() => setOpen(false)}
          />
          <div className="metric-info__popover" role="tooltip">
            <div className="metric-info__popover-header">
              <strong>{label}</strong>
              <button
                type="button"
                className="metric-info__close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <p>{definition}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricInfo;
