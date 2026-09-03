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
import type {AdminStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParams, 'AdminOrders'>;

const FILTERS: {label: string; value: OrderStatus | null}[] = [
  {label: 'All', value: null},
  {label: 'Pending', value: 'pending'},
  {label: 'Paid', value: 'paid'},
  {label: 'Processing', value: 'processing'},
  {label: 'Shipped', value: 'shipped'},
  {label: 'Delivered', value: 'delivered'},
  {label: 'Cancelled', value: 'cancelled'},
];

const AdminOrdersScreen = ({route, navigation}: Props) => {
  const [status, setStatus] = useState<OrderStatus | null>(
    route.params?.status ?? null,
  );

  const run = useCallback(async () => {
    const {data} = await ordersApi.list({
      limit: 100,
      ...(status ? {status} : {}),
    });
    return data.orders;
  }, [status]);

  const {data: orders, loading, refreshing, error, refresh} = useAsync(run, [status]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
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
      }
      renderItem={({item}) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('AdminOrderDetail', {id: item.id})}>
          <View style={styles.head}>
            <Text style={styles.orderId}>#{shortId(item.id)}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.customer}>{item.customer_name ?? 'Guest'}</Text>
          <Text style={styles.meta}>
            {formatDate(item.created_at)} · {item.item_count ?? 0} item
            {Number(item.item_count) === 1 ? '' : 's'}
          </Text>
          <View style={styles.foot}>
            <Text style={styles.total}>{formatMoney(item.total)}</Text>
            <Icon name="chevron-right" size={20} color={colors.textFaint} />
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-text-outline"
          title="No orders"
          message={status ? 'Nothing with this status.' : 'Orders will appear here.'}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl},
  chips: {paddingBottom: spacing.md},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {fontSize: font.md, fontWeight: '700', color: colors.text},
  customer: {fontSize: font.sm, color: colors.text, marginTop: spacing.xs},
  meta: {fontSize: font.xs, color: colors.textMuted},
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  total: {fontSize: font.lg, fontWeight: '700', color: colors.text},
});

export default AdminOrdersScreen;
