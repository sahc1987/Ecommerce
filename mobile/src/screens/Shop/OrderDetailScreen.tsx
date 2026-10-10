import React, {useCallback, useState} from 'react';
import {Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ordersApi, returnsApi} from '../../api';
import {errorMessage} from '../../api/client';
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
import type {Order, ReturnRequest} from '../../types';
import {mediaUrl} from '../../utils/media';

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

  const {data, setData, loading, refreshing, error, refresh} = useAsync(run, [id]);
  const [cancelling, setCancelling] = useState(false);

  const cancel = async () => {
    setCancelling(true);
    try {
      const {data: res} = await ordersApi.cancel(id);
      // The cancel response has no items — keep ours.
      setData(prev => (prev ? {...prev, order: {...prev.order, ...res.order, items: prev.order.items}} : prev));
    } catch (err) {
      Alert.alert('Could not cancel', errorMessage(err));
      void refresh();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <Loading />;
  }
  if (error || !data) {
    return <ErrorState message={error ?? 'Order not found'} onRetry={refresh} />;
  }

  const {order, existingReturn} = data;
  const address = order.shipping_address;

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
              <Image source={{uri: mediaUrl(item.product_image)}} style={styles.image} />
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
                {item.variant_label ? `${item.variant_label} · ` : ''}
                {item.quantity} × {formatMoney(item.unit_price)}
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
        {Number.parseFloat(order.refunded_amount ?? '0') > 0 ? (
          <Row label="Refunded" value={`- ${formatMoney(order.refunded_amount)}`} />
        ) : null}
      </Card>

      {order.can_cancel ? (
        <CancelSection order={order} cancelling={cancelling} onCancel={cancel} />
      ) : null}

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

      {order.status === 'cancelled' ? null : (
        <>
          <SectionTitle title="Returns" />
          <Card>
            <ReturnSection
          order={order}
          existingReturn={existingReturn}
          returnWindow={returnWindow}
          onRequest={() => navigation.navigate('RequestReturn', {orderId: order.id})}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
};

// A paid card order is refunded in full when cancelled.
const refundsOnCancel = (o: Order) =>
  o.payment_method === 'stripe' &&
  (o.payment_status === 'paid' || o.payment_status === 'partially_refunded');

/** Cancel button, shown until the store starts preparing the order. */
const CancelSection = ({
  order,
  cancelling,
  onCancel,
}: Readonly<{order: Order; cancelling: boolean; onCancel: () => void}>) => {
  const refund = refundsOnCancel(order);
  const confirm = () =>
    Alert.alert(
      'Cancel this order?',
      `This cannot be undone.${refund ? ' Your payment will be refunded to your card.' : ''}`,
      [
        {text: 'Keep order', style: 'cancel'},
        {text: 'Cancel order', style: 'destructive', onPress: onCancel},
      ],
    );
  return (
    <>
      <SectionTitle title="Changed your mind?" />
      <Card>
        <Text style={styles.itemMeta}>
          You can cancel until we start preparing your order
          {refund ? '; the payment is refunded to your card.' : '.'}
        </Text>
        <Button
          title="Cancel order"
          variant="danger"
          icon="close-circle-outline"
          onPress={confirm}
          loading={cancelling}
          style={styles.returnCta}
        />
      </Card>
    </>
  );
};

/** Existing return status, the request button, or why a return isn't possible. */
const ReturnSection = ({
  order,
  existingReturn,
  returnWindow,
  onRequest,
}: Readonly<{
  order: Order;
  existingReturn: ReturnRequest | null;
  returnWindow: number;
  onRequest: () => void;
}>) => {
  if (existingReturn) {
    return (
      <View style={styles.returnRow}>
        <View style={styles.flex}>
          <Text style={styles.itemName}>Return requested</Text>
          <Text style={styles.itemMeta} numberOfLines={2}>
            {existingReturn.reason}
          </Text>
        </View>
        <StatusBadge status={existingReturn.status} />
      </View>
    );
  }

  // Before delivery the order is cancelled instead of returned.
  if (order.status !== 'delivered') {
    return <Text style={styles.itemMeta}>Returns open once the order is delivered.</Text>;
  }

  const daysSince = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000);
  const daysLeft = returnWindow - daysSince;
  if (daysLeft < 0) {
    return (
      <Text style={styles.itemMeta}>
        The {returnWindow}-day return window for this order has passed.
      </Text>
    );
  }

  return (
    <>
      <Text style={styles.itemMeta}>
        Eligible for return for another {daysLeft} day{daysLeft === 1 ? '' : 's'}.
      </Text>
      <Button
        title="Request a return"
        variant="secondary"
        icon="backup-restore"
        onPress={onRequest}
        style={styles.returnCta}
      />
    </>
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
