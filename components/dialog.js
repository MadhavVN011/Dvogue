'use client';
import { useEffect, useRef } from 'react';
export default function Dialog({ open, onClose, label, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => { if (open && !ref.current.open) ref.current.showModal(); if (!open && ref.current.open) ref.current.close(); }, [open]);
  return <dialog ref={ref} className={className} aria-labelledby={label} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog-inner">{children}</div></dialog>;
}
