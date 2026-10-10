import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {returnsApi} from '../../api';
import {errorMessage} from '../../api/client';
import {useAsync} from '../../hooks/useAsync';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  StatusBadge,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDate, formatMoney, shortId} from '../../utils/format';
import type {ReturnRequest, ReturnStatus} from '../../types';

const FILTERS: {label: string; value: ReturnStatus | null}[] = [
  {label: 'All', value: null},
  {label: 'Requested', value: 'requested'},
  {label: 'Approved', value: 'approved'},
  {label: 'Rejected', value: 'rejected'},
  {label: 'Refunded', value: 'refunded'},
];

// Decisions allowed from each return status (mirrors the server's rules);
// rejected and refunded returns are final.
const DECISIONS: Partial<Record<ReturnStatus, {value: ReturnStatus; label: string}[]>> = {
  requested: [
    {value: 'approved', label: 'Approve'},
    {value: 'rejected', label: 'Reject'},
    {value: 'refunded', label: 'Approve & refund'},
  ],
  approved: [{value: 'refunded', label: 'Issue refund'}],
};

/** What can still be refunded on the return's order. */
const refundableLeft = (r: ReturnRequest) =>
  Math.max(
    0,
    Number.parseFloat(r.order_total ?? '0') - Number.parseFloat(r.order_refunded_amount ?? '0'),
  );

const AdminReturnsScreen = () => {
  const [status, setStatus] = useState<ReturnStatus | null>(null);
  const [active, setActive] = useState<ReturnRequest | null>(null);
  const [decision, setDecision] = useState<ReturnStatus>('approved');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [restock, setRestock] = useState(true);
  const [saving, setSaving] = useState(false);

  const run = useCallback(async () => {
    const {data} = await returnsApi.list({
      page: 1,
      ...(status ? {status} : {}),
    });
    return data.returns;
  }, [status]);

  const {data: returns, loading, refreshing, error, refresh} = useAsync(run, [status]);

  const openReview = (item: ReturnRequest) => {
    const options = DECISIONS[item.status];
    if (!options) {
      Alert.alert('Return closed', `This return was ${item.status} and can no longer change.`);
      return;
    }
    setActive(item);
    setDecision(options[0].value);
    // An amount set when approving is reused; otherwise what's left to refund.
    setRefundAmount(item.refund_amount ?? refundableLeft(item).toFixed(2));
    setNotes(item.admin_notes ?? '');
    setRestock(true);
  };

  const amountNeeded = decision === 'refunded' && !refundAmount.trim();

  const save = async () => {
    if (!active || amountNeeded) {
      return;
    }
    setSaving(true);
    try {
      await returnsApi.process(active.id, {
        status: decision,
        // Optional when approving (saved for the refund later); required to refund.
        ...(decision !== 'rejected' && refundAmount.trim()
          ? {refund_amount: Number.parseFloat(refundAmount)}
          : {}),
        admin_notes: notes.trim() || undefined,
        ...(decision === 'refunded' ? {restock} : {}),
      });
      setActive(null);
      await refresh();
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <>
      <FlatList
        style={styles.screen}
        data={returns ?? []}
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
          <Pressable style={styles.card} onPress={() => openReview(item)}>
            <View style={styles.head}>
              <Text style={styles.orderId}>Order #{shortId(item.order_id)}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.customer}>{item.customer_name ?? 'Customer'}</Text>
            <Text style={styles.meta}>
              {formatDate(item.created_at)}
              {item.order_total ? ` · order ${formatMoney(item.order_total)}` : ''}
            </Text>
            <Text style={styles.reason} numberOfLines={3}>
              {item.reason}
            </Text>
            {item.refund_amount ? (
              <Text style={styles.refund}>
                {item.status === 'refunded' ? 'Refunded' : 'Refund'} {formatMoney(item.refund_amount)}
                {item.status === 'refunded' ? (
                  <Text style={styles.meta}>
                    {item.restocked ? ' · restocked' : ' · not restocked'}
                  </Text>
                ) : null}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="backup-restore"
            title="No return requests"
            message={status ? 'Nothing with this status.' : 'Requests will show here.'}
          />
        }
      />

      <Modal visible={!!active} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Review return request</Text>
            {active ? (
              <Text style={styles.modalReason}>{active.reason}</Text>
            ) : null}
            <View style={styles.chipWrap}>
              {(active ? DECISIONS[active.status] ?? [] : []).map(d => (
                <Chip
                  key={d.value}
                  label={d.label}
                  active={decision === d.value}
                  onPress={() => setDecision(d.value)}
                />
              ))}
            </View>
            {active && decision !== 'rejected' ? (
              <Field
                label={decision === 'refunded' ? 'Refund amount' : 'Refund amount (optional)'}
                value={refundAmount}
                onChangeText={setRefundAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                hint={`Up to ${formatMoney(refundableLeft(active))}${
                  active.order_payment_method === 'stripe'
                    ? ' · refunded to the card through Stripe'
                    : ' · cash on delivery: give the money back yourself; this records it'
                }`}
                error={amountNeeded ? 'Required to refund' : null}
                style={styles.spaced}
              />
            ) : null}
            {decision === 'refunded' ? (
              <View style={styles.restockRow}>
                <View style={styles.flex}>
                  <Text style={styles.restockLabel}>Return items to stock</Text>
                  <Text style={styles.meta}>Turn off if the items are damaged.</Text>
                </View>
                <Switch
                  value={restock}
                  onValueChange={setRestock}
                  trackColor={{true: colors.primary, false: colors.border}}
                  accessibilityLabel="Return items to stock"
                />
              </View>
            ) : null}
            <Field
              label="Note to the customer"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional — included in their notification"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={decision === 'refunded' ? undefined : styles.spaced}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setActive(null)}
                style={styles.flex}
              />
              <Button
                title="Save"
                onPress={save}
                loading={saving}
                disabled={amountNeeded}
                style={styles.flex}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
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
  reason: {fontSize: font.sm, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 19},
  refund: {fontSize: font.sm, fontWeight: '700', color: colors.success, marginTop: spacing.sm},
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
  modalTitle: {fontSize: font.lg, fontWeight: '700', color: colors.text},
  modalReason: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  spaced: {marginTop: spacing.lg},
  restockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  restockLabel: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  modalActions: {flexDirection: 'row', gap: spacing.md},
});

export default AdminReturnsScreen;
