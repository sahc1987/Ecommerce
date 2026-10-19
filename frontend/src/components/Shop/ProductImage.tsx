import { createElement, useState } from 'react';
import { mediaUrl } from '../../utils/media';
import { categoryIcon } from '../../utils/categoryIcon';

type Size = 'thumb' | 'card' | 'large';

interface Props {
  src?: string | null;
  /** The product name: the image's alt text and the placeholder's label. */
  alt: string;
  /** Picks the placeholder icon (laptop, headphones…). */
  category?: string | null;
  size?: Size;
  /** Sizing from the caller, e.g. "w-14 h-14" or "aspect-square w-full". */
  className?: string;
  /** Extra classes on the <img>, e.g. a hover zoom inside a `group`. */
  imgClassName?: string;
  /** The page's main image: load it first instead of lazily. */
  priority?: boolean;
}

const PADDING: Record<Size, string> = { thumb: 'p-1', card: 'p-3', large: 'p-6 sm:p-10' };
const ICON: Record<Size, number> = { thumb: 18, card: 36, large: 64 };
const RADIUS: Record<Size, string> = { thumb: 'rounded-lg', card: 'rounded-xl', large: 'rounded-2xl' };

/**
 * Every product photo sits in the same neutral frame (white, thin border, the
 * whole product visible — never cropped), so colour comes from the products
 * themselves. Without a photo, or if the file fails to load, a calm
 * placeholder shows the category icon instead.
 */
export default function ProductImage({
  src, alt, category, size = 'card', className = '', imgClassName = '', priority = false,
}: Readonly<Props>) {
  const url = mediaUrl(src);
  // Remember which URL failed, so a new src gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const showPhoto = url && failedUrl !== url;
  // React 18 doesn't know `fetchPriority` (React 19 does) but passes unknown
  // lowercase attributes through to the HTML.
  const priorityHint = priority ? { fetchpriority: 'high' } : {};

  return (
    <div
      className={`${RADIUS[size]} bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center ${className}`}
    >
      {showPhoto ? (
        <img
          src={url}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          {...priorityHint}
          decoding="async"
          onError={() => setFailedUrl(url)}
          className={`w-full h-full object-contain ${PADDING[size]} ${imgClassName}`}
        />
      ) : (
        <div
          role="img"
          aria-label={`${alt}, no photo yet`}
          className="w-full h-full bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400"
        >
          {/* createElement: the icon is a module constant picked by name, not a
              component created here. */}
          {createElement(categoryIcon(category ?? ''), { size: ICON[size], strokeWidth: 1.5, 'aria-hidden': true })}
          {size !== 'thumb' && <span className="text-xs text-slate-500">Photo coming soon</span>}
        </div>
      )}
    </div>
  );
}
