import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {notificationsApi} from '../api';
import {useAppSelector} from '../store/hooks';

const POLL_MS = 60000;

/**
 * Drives the badge on the Alerts tab. The backend has no push channel, so this
 * polls on an interval and whenever the app returns to the foreground.
 */
export const useUnreadCount = () => {
  const userId = useAppSelector(s => s.auth.user?.id);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const {data} = await notificationsApi.list({limit: 1});
        if (!cancelled) {
          setUnread(data.unread);
        }
      } catch {
        // A badge is not worth surfacing an error for.
      }
    };

    void fetchCount();
    const timer = setInterval(fetchCount, POLL_MS);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void fetchCount();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);

  return unread;
};
