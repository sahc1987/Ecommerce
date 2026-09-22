import { Store } from 'lucide-react';
import { mediaUrl } from '../utils/media';

interface Props {
  logoUrl?: string | null;
  name: string;
  size?: number; // px
  className?: string;
}

// Uploaded store logo when one exists, otherwise the generic store mark.
export default function StoreLogo({ logoUrl, name, size = 36, className = '' }: Readonly<Props>) {
  const src = mediaUrl(logoUrl);
  if (src) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        className={`rounded-xl object-contain bg-white border border-slate-100 flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/30 flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Store size={Math.round(size * 0.47)} className="text-white" />
    </div>
  );
}
