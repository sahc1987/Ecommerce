import React, {useCallback} from 'react';
import {Image, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ordersApi, returnsApi} from '../../api';
import {useAsync} from '../../hooks/useAsync';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  Loading,
  Row,
  SectionTitle,
  StatusBadge,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDateTime, formatMoney, shortId} from '../../utils/format';
import {useAppSelector} from '../../store/hooks';
import type {OrdersStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParams, 'OrderDetail'>;

const OrderDetailScreen = ({route, navigation}: Props) => {
  const {id} = route.params;
  const returnWindow = useAppSelector(
    s => s.settings.store?.return_window_days ?? 30,
  );

  const run = useCallback(async () => {
    const [orderRes, returnsRes] = await Promise.all([
      ordersApi.detail(id),
      // Tells us whether a return already exists so we don't offer a duplicate.
      returnsApi.list({order_id: id}).catch(() => null),
    ]);
    return {
      order: orderRes.data.order,
      existingReturn: returnsRes?.data.returns[0] ?? null,
    };
  }, [id]);

  const {data, loading, refreshing, error, refresh} = useAsync(run, [id]);

  if (loading) {
    return <Loading />;
  }
  if (error || !data) {
    return <ErrorState message={error ?? 'Order not found'} onRetry={refresh} />;
  }

  const {order, existingReturn} = data;
  const address = order.shipping_address;
  const daysSince = Math.floor(
    (Date.now() - new Date(order.created_at).getTime()) / 86400000,
  );
  const eligible =
    ['delivered', 'paid'].includes(order.status) &&
    !existingReturn &&
    daysSince <= returnWindow;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Card>
        <View style={styles.head}>
          <View>
            <Text style={styles.orderId}>#{shortId(order.id)}</Text>
            <Text style={styles.meta}>{formatDateTime(order.created_at)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
        {order.status === 'shipped' && order.tracking_number ? (
          <View style={styles.trackBox}>
            <Icon name="truck-outline" size={18} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.trackCarrier}>{order.carrier ?? 'Carrier'}</Text>
              <Text style={styles.trackNumber}>{order.tracking_number}</Text>
            </View>
          </View>
        ) : null}
      </Card>

      <SectionTitle title="Items" />
      <Card>
        {(order.items ?? []).map((item, index) => (
          <View
            key={item.id}
            style={[styles.item, index > 0 && styles.itemBordered]}>
            {item.product_image ? (
              <Image source={{uri: item.product_image}} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imageFallback]}>
                <Icon name="image-outline" size={18} color={colors.textFaint} />
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={styles.itemMeta}>
                {item.quantity} × {formatMoney(item.price)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatMoney(item.total)}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle title="Summary" />
      <Card>
        <Row label="Subtotal" value={formatMoney(order.subtotal)} />
        {Number.parseFloat(order.discount) > 0 ? (
          <Row label="Discount" value={`- ${formatMoney(order.discount)}`} />
        ) : null}
        {Number.parseFloat(order.tax) > 0 ? (
          <Row label="Tax" value={formatMoney(order.tax)} />
        ) : null}
        <Row
          label="Shipping"
          value={
            Number.parseFloat(order.shipping) > 0
              ? formatMoney(order.shipping)
              : 'Free'
          }
        />
        <View style={styles.divider} />
        <Row label="Total" value={formatMoney(order.total)} strong />
      </Card>

      {address ? (
        <>
          <SectionTitle title="Shipping to" />
          <Card>
            <Text style={styles.addressName}>{address.name}</Text>
            <Text style={styles.addressLine}>{address.line1}</Text>
            {address.line2 ? (
              <Text style={styles.addressLine}>{address.line2}</Text>
            ) : null}
            <Text style={styles.addressLine}>
              {[address.city, address.state, address.zip]
                .filter(Boolean)
                .join(', ')}
            </Text>
            <Text style={styles.addressLine}>{address.country}</Text>
          </Card>
        </>
      ) : null}

      {order.notes ? (
        <>
          <SectionTitle title="Notes" />
          <Card>
            <Text style={styles.notes}>{order.notes}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle title="Returns" />
      <Card>
        {existingReturn ? (
          <View style={styles.returnRow}>
            <View style={styles.flex}>
              <Text style={styles.itemName}>Return requested</Text>
              <Text style={styles.itemMeta} numberOfLines={2}>
                {existingReturn.reason}
              </Text>
            </View>
            <StatusBadge status={existingReturn.status} />
          </View>
        ) : eligible ? (
          <>
            <Text style={styles.itemMeta}>
              Eligible for return for another {returnWindow - daysSince} day
              {returnWindow - daysSince === 1 ? '' : 's'}.
            </Text>
            <Button
              title="Request a return"
              variant="secondary"
              icon="backup-restore"
              onPress={() => navigation.navigate('RequestReturn', {orderId: order.id})}
              style={styles.returnCta}
            />
          </>
        ) : (
          <Text style={styles.itemMeta}>
            {['delivered', 'paid'].includes(order.status)
              ? `The ${returnWindow}-day return window for this order has passed.`
              : 'Returns open once the order is paid or delivered.'}
          </Text>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  flex: {flex: 1},
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderId: {fontSize: font.lg, fontWeight: '700', color: colors.text},
  meta: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  trackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  trackCarrier: {fontSize: font.xs, color: colors.textMuted},
  trackNumber: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  item: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md},
  itemBordered: {borderTopWidth: 1, borderTopColor: colors.border},
  image: {width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt},
  imageFallback: {alignItems: 'center', justifyContent: 'center'},
  itemName: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  itemMeta: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  itemTotal: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  divider: {height: 1, backgroundColor: colors.border, marginVertical: spacing.sm},
  addressName: {fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.xs},
  addressLine: {fontSize: font.sm, color: colors.textMuted, lineHeight: 20},
  notes: {fontSize: font.sm, color: colors.textMuted, lineHeight: 20},
  returnRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  returnCta: {marginTop: spacing.md},
});

export default OrderDetailScreen;
