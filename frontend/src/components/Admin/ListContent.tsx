import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  loading: boolean;
  isEmpty: boolean;
  emptyIcon: LucideIcon;
  emptyText: string;
  children: ReactElement;
}

// Loading spinner → empty state → content, shared by the admin list tables.
export default function ListContent({ loading, isEmpty, emptyIcon: EmptyIcon, emptyText, children }: Readonly<Props>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="text-center py-16 text-slate-400">
        <EmptyIcon size={40} className="mx-auto mb-3 opacity-40" />
        <p>{emptyText}</p>
      </div>
    );
  }
  return children;
}
