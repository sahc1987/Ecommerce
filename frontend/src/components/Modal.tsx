import { ReactNode, useEffect, useRef } from 'react';

interface Props {
  /** Accessible name of the dialog. */
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

// A native modal <dialog>, rendered only while open: focus moves in, the page
// behind is inert, and Escape or a press on the backdrop closes it.
export default function Modal({
  label, onClose, children, className = 'w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl',
}: Readonly<Props>) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      // Backdrop presses land on the <dialog> itself, outside its box. Checked
      // on mousedown so a text selection dragged out of an input doesn't close it.
      onMouseDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          e.currentTarget.close();
        }
      }}
      className={`backdrop:bg-black/50 ${className}`}
    >
      {children}
    </dialog>
  );
}
