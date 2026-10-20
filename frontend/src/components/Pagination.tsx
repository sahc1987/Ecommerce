interface Props {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  className?: string;
}

/** Previous / "Page 2 of 5" / Next under a paged list; nothing for a single page. */
export default function Pagination({ page, pages, onChange, className = '' }: Readonly<Props>) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-3 ${className}`}>
      <button
        type="button"
        className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm text-slate-600" aria-live="polite">Page {page} of {pages}</span>
      <button
        type="button"
        className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
