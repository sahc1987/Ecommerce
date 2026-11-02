import { useEffect } from 'react';
import { useStoreSettings } from './useStoreSettings';

/** Tab title "<title> | <store>" while the page is mounted (WCAG 2.4.2); empty keeps the store name. */
export function useDocumentTitle(title: string) {
  const name = useStoreSettings().store?.name;
  useEffect(() => {
    if (!title) return;
    document.title = name ? `${title} | ${name}` : title;
    return () => {
      if (name) document.title = name;
    };
  }, [title, name]);
}
