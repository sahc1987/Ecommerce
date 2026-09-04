import React, {useCallback, useState} from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ordersApi} from '../../api';
import {errorMessage} from '../../api/client';
import {useAsync} from '../../hooks/useAsync';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Icon,
  Loading,
  Row,
  SectionTitle,
  StatusBadge,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDateTime, formatMoney, shortId} from '../../utils/format';
import type {OrderStatus} from '../../types';
import type {AdminStackParams} from '../../navigation/types';
import {mediaUrl} from '../../utils/media';

type Props = NativeStackScreenProps<AdminStackParams, 'AdminOrderDetail'>;

const STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const AdminOrderDetailScreen = ({route}: Props) => {
  const {id} = route.params;
  const [editing, setEditing] = useState(false);
  const [nextStatus, setNextStatus] = useState<OrderStatus>('paid');
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [saving, setSaving] = useState(false);

  const run = useCallback(async () => {
    const {data} = await ordersApi.detail(id);
    return data.order;
  }, [id]);

  const {data: order, setData, loading, refreshing, error, refresh} = useAsync(
    run,
    [id],
  );

  const openEditor = () => {
    if (!order) {
      return;
    }
    setNextStatus(order.status);
    setTracking(order.tracking_number ?? '');
    setCarrier(order.carrier ?? '');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const {data} = await ordersApi.updateStatus(id, {
        status: nextStatus,
        ...(nextStatus === 'shipped'
          ? {tracking_number: tracking.trim(), carrier: carrier.trim()}
          : {}),
      });
      // The status endpoint returns the order without its items — keep ours.
      setData(prev => (prev ? {...prev, ...data.order, items: prev.items} : prev));
      setEditing(false);
    } catch (err) {
      Alert.alert('Could not update', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading />;
  }
  if (error || !order) {
    return <ErrorState message={error ?? 'Order not found'} onRetry={refresh} />;
  }

  const address = order.shipping_address;

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }>
        <Card>
          <View style={styles.head}>
            <View>
              <Text style={styles.orderId}>#{shortId(order.id)}</Text>
              <Text style={styles.meta}>{formatDateTime(order.created_at)}</Text>
            </View>
            <StatusBadge status={order.status} />
          </View>
          <View style={styles.divider} />
          <Row label="Customer" value={order.customer_name ?? 'Guest'} />
          {order.customer_email ? (
            <Row label="Email" value={order.customer_email} />
          ) : null}
          {order.tracking_number ? (
            <Row
              label="Tracking"
              value={`${order.carrier ? order.carrier + ' · ' : ''}${order.tracking_number}`}
            />
          ) : null}
          <Button
            title="Update status"
            variant="secondary"
            icon="progress-check"
            onPress={openEditor}
            style={styles.updateCta}
          />
        </Card>

        <SectionTitle title="Items" />
        <Card>
          {(order.items ?? []).map((item, index) => (
            <View key={item.id} style={[styles.item, index > 0 && styles.itemBordered]}>
              {item.product_image ? (
                <Image source={{uri: mediaUrl(item.product_image)}} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="image-outline" size={18} color={colors.textFaint} />
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.product_name}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {formatMoney(item.unit_price)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatMoney(item.total)}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle title="Totals" />
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
            <SectionTitle title="Ship to" />
            <Card>
              <Text style={styles.addressName}>{address.name}</Text>
              <Text style={styles.addressLine}>{address.line1}</Text>
              {address.line2 ? (
                <Text style={styles.addressLine}>{address.line2}</Text>
              ) : null}
              <Text style={styles.addressLine}>
                {[address.city, address.state, address.zip].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.addressLine}>{address.country}</Text>
            </Card>
          </>
        ) : null}

        {order.notes ? (
          <>
            <SectionTitle title="Customer notes" />
            <Card>
              <Text style={styles.addressLine}>{order.notes}</Text>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={editing} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Update order status</Text>
            <View style={styles.chipWrap}>
              {STATUSES.map(s => (
                <Chip
                  key={s}
                  label={s}
                  active={nextStatus === s}
                  onPress={() => setNextStatus(s)}
                />
              ))}
            </View>
            {nextStatus === 'shipped' ? (
              <View style={styles.shipFields}>
                <Field
                  label="Carrier"
                  value={carrier}
                  onChangeText={setCarrier}
                  placeholder="e.g. UPS"
                />
                <Field
                  label="Tracking number"
                  value={tracking}
                  onChangeText={setTracking}
                  placeholder="1Z999AA10123456784"
                  autoCapitalize="characters"
                  hint="The customer is notified with these details."
                />
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setEditing(false)}
                style={styles.flex}
              />
              <Button title="Save" onPress={save} loading={saving} style={styles.flex} />
            </View>
          </View>
        </View>
      </Modal>
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
  divider: {height: 1, backgroundColor: colors.border, marginVertical: spacing.md},
  updateCta: {marginTop: spacing.md},
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemBordered: {borderTopWidth: 1, borderTopColor: colors.border},
  thumb: {width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt},
  thumbFallback: {alignItems: 'center', justifyContent: 'center'},
  itemName: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  itemMeta: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  itemTotal: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  addressName: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addressLine: {fontSize: font.sm, color: colors.textMuted, lineHeight: 20},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  shipFields: {marginTop: spacing.lg},
  modalActions: {flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg},
});

export default AdminOrderDetailScreen;
