import React, {useCallback, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ordersApi} from '../../api';
import {useAsync} from '../../hooks/useAsync';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Loading,
  StatusBadge,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDate, formatMoney, shortId} from '../../utils/format';
import type {OrderStatus} from '../../types';
import type {OrdersStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParams, 'MyOrders'>;

const FILTERS: {label: string; value: OrderStatus | null}[] = [
  {label: 'All', value: null},
  {label: 'Pending', value: 'pending'},
  {label: 'Paid', value: 'paid'},
  {label: 'Shipped', value: 'shipped'},
  {label: 'Delivered', value: 'delivered'},
  {label: 'Cancelled', value: 'cancelled'},
];

const MyOrdersScreen = ({navigation}: Props) => {
  const [status, setStatus] = useState<OrderStatus | null>(null);

  const run = useCallback(async () => {
    const {data} = await ordersApi.list({
      limit: 50,
      ...(status ? {status} : {}),
    });
    return data.orders;
  }, [status]);

  const {data: orders, loading, refreshing, error, refresh} = useAsync(run, [status]);

  const header = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {FILTERS.map(f => (
          <Chip
            key={f.label}
            label={f.label}
            active={status === f.value}
            onPress={() => setStatus(f.value)}
          />
        ))}
      </ScrollView>
      <Pressable
        style={styles.returnsLink}
        onPress={() => navigation.navigate('MyReturns')}>
        <Icon name="backup-restore" size={18} color={colors.primary} />
        <Text style={styles.returnsText}>View my return requests</Text>
        <Icon name="chevron-right" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <FlatList
      style={styles.screen}
      data={orders ?? []}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      renderItem={({item}) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('OrderDetail', {id: item.id})}>
          <View style={styles.cardHead}>
            <Text style={styles.orderId}>#{shortId(item.id)}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.meta}>
            {formatDate(item.created_at)} · {item.item_count ?? 0} item
            {Number(item.item_count) === 1 ? '' : 's'}
          </Text>
          {item.status === 'shipped' && item.tracking_number ? (
            <Text style={styles.tracking}>
              {item.carrier ? `${item.carrier} · ` : ''}
              {item.tracking_number}
            </Text>
          ) : null}
          <View style={styles.cardFoot}>
            <Text style={styles.total}>{formatMoney(item.total)}</Text>
            <Icon name="chevron-right" size={20} color={colors.textFaint} />
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="package-variant"
          title="No orders yet"
          message={
            status
              ? 'No orders with this status.'
              : 'Your completed orders will appear here.'
          }
          action={
            status ? (
              <Button
                title="Clear filter"
                variant="secondary"
                onPress={() => setStatus(null)}
              />
            ) : undefined
          }
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl},
  chips: {paddingBottom: spacing.md},
  returnsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  returnsText: {flex: 1, color: colors.primary, fontWeight: '600', fontSize: font.sm},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {fontSize: font.md, fontWeight: '700', color: colors.text},
  meta: {fontSize: font.xs, color: colors.textMuted},
  tracking: {fontSize: font.xs, color: colors.primary},
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  total: {fontSize: font.lg, fontWeight: '700', color: colors.text},
});

export default MyOrdersScreen;
