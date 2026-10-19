import { useState } from 'react';
import { Store } from 'lucide-react';
import { mediaUrl } from '../utils/media';

interface Props {
  logoUrl?: string | null;
  name: string;
  size?: number; // px
  className?: string;
}

// Uploaded store logo when one exists (and loads), otherwise the generic store mark.
export default function StoreLogo({ logoUrl, name, size = 36, className = '' }: Readonly<Props>) {
  const src = mediaUrl(logoUrl);
  // Remember which URL failed, so a newly uploaded logo gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        onError={() => setFailedSrc(src)}
        className={`rounded-xl object-contain bg-white border border-slate-100 shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${name} logo`}
      className={`bg-linear-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/30 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Store size={Math.round(size * 0.47)} className="text-white" aria-hidden="true" />
    </div>
  );
}
