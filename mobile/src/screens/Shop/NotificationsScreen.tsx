import React, {useCallback, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {notificationsApi} from '../../api';
import {useAsync} from '../../hooks/useAsync';
import {EmptyState, ErrorState, Icon, Loading} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDateTime} from '../../utils/format';
import type {AppNotification} from '../../types';

const ICON_FOR_TYPE: Record<string, string> = {
  order_status: 'truck-outline',
  return_request: 'backup-restore',
  return_response: 'reply-outline',
  new_order: 'cart-outline',
  low_stock: 'alert-outline',
};

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    const {data} = await notificationsApi.list({limit: 50});
    return data;
  }, []);

  const {data, setData, loading, refreshing, error, refresh} = useAsync(run, []);

  const open = async (item: AppNotification) => {
    if (!item.is_read) {
      // Optimistic — the badge and row should react immediately.
      setData(prev =>
        prev
          ? {
              ...prev,
              unread: Math.max(0, prev.unread - 1),
              notifications: prev.notifications.map(n =>
                n.id === item.id ? {...n, is_read: true} : n,
              ),
            }
          : prev,
      );
      notificationsApi.markRead(item.id).catch(() => refresh());
    }
    const orderId = item.metadata?.order_id as string | undefined;
    if (orderId) {
      // @ts-expect-error — cross-tab navigation is untyped here
      navigation.navigate('OrdersTab', {
        screen: 'OrderDetail',
        params: {id: orderId},
      });
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationsApi.markAllRead();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setData(prev =>
      prev
        ? {...prev, notifications: prev.notifications.filter(n => n.id !== id)}
        : prev,
    );
    notificationsApi.remove(id).catch(() => refresh());
  };

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  return (
    <FlatList
      style={styles.screen}
      data={notifications}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        unread > 0 ? (
          <Pressable
            style={styles.markAll}
            onPress={markAll}
            disabled={busy}>
            <Icon name="check-all" size={18} color={colors.primary} />
            <Text style={styles.markAllText}>
              Mark all {unread} as read
            </Text>
          </Pressable>
        ) : (
          <View />
        )
      }
      renderItem={({item}) => (
        <Pressable
          style={[styles.card, !item.is_read && styles.cardUnread]}
          onPress={() => open(item)}>
          <View
            style={[
              styles.iconWrap,
              !item.is_read && styles.iconWrapUnread,
            ]}>
            <Icon
              name={ICON_FOR_TYPE[item.type] ?? 'bell-outline'}
              size={20}
              color={item.is_read ? colors.textMuted : colors.primary}
            />
          </View>
          <View style={styles.body}>
            <Text style={[styles.title, !item.is_read && styles.titleUnread]}>
              {item.title}
            </Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => remove(item.id)}>
            <Icon name="close" size={18} color={colors.textFaint} />
          </Pressable>
        </Pressable>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="bell-outline"
          title="You are all caught up"
          message="Order updates and store messages land here."
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl},
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  markAllText: {color: colors.primary, fontWeight: '600', fontSize: font.sm},
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardUnread: {borderColor: colors.primary},
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {backgroundColor: colors.primarySoft},
  body: {flex: 1, gap: 2},
  title: {fontSize: font.sm, fontWeight: '600', color: colors.textMuted},
  titleUnread: {color: colors.text, fontWeight: '700'},
  message: {fontSize: font.sm, color: colors.textMuted, lineHeight: 19},
  time: {fontSize: font.xs, color: colors.textFaint, marginTop: 2},
});

export default NotificationsScreen;
