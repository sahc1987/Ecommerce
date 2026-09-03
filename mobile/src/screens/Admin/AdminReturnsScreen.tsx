import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

const DECISIONS: ReturnStatus[] = ['approved', 'rejected', 'refunded'];

const AdminReturnsScreen = () => {
  const [status, setStatus] = useState<ReturnStatus | null>(null);
  const [active, setActive] = useState<ReturnRequest | null>(null);
  const [decision, setDecision] = useState<ReturnStatus>('approved');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');
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
    setActive(item);
    setDecision(item.status === 'requested' ? 'approved' : item.status);
    setRefundAmount(item.refund_amount ?? item.order_total ?? '');
    setNotes(item.admin_notes ?? '');
  };

  const save = async () => {
    if (!active) {
      return;
    }
    setSaving(true);
    try {
      await returnsApi.process(active.id, {
        status: decision,
        ...(decision === 'refunded' && refundAmount
          ? {refund_amount: Number.parseFloat(refundAmount)}
          : {}),
        admin_notes: notes.trim() || undefined,
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
                Refunded {formatMoney(item.refund_amount)}
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
              {DECISIONS.map(d => (
                <Chip
                  key={d}
                  label={d}
                  active={decision === d}
                  onPress={() => setDecision(d)}
                />
              ))}
            </View>
            {decision === 'refunded' ? (
              <Field
                label="Refund amount"
                value={refundAmount}
                onChangeText={setRefundAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={styles.spaced}
              />
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
  modalActions: {flexDirection: 'row', gap: spacing.md},
});

export default AdminReturnsScreen;
