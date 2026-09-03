import React, {useCallback} from 'react';
import {FlatList, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {returnsApi} from '../../api';
import {useAsync} from '../../hooks/useAsync';
import {EmptyState, ErrorState, Loading, StatusBadge} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDate, formatMoney, shortId} from '../../utils/format';

const MyReturnsScreen = () => {
  const run = useCallback(async () => {
    const {data} = await returnsApi.list({page: 1});
    return data.returns;
  }, []);

  const {data: returns, loading, refreshing, error, refresh} = useAsync(run, []);

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <FlatList
      style={styles.screen}
      data={returns ?? []}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      renderItem={({item}) => (
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.orderId}>Order #{shortId(item.order_id)}</Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.date}>Requested {formatDate(item.created_at)}</Text>
          <Text style={styles.reason}>{item.reason}</Text>
          {item.admin_notes ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Store response</Text>
              <Text style={styles.noteText}>{item.admin_notes}</Text>
            </View>
          ) : null}
          {item.refund_amount ? (
            <Text style={styles.refund}>
              Refunded {formatMoney(item.refund_amount)}
            </Text>
          ) : null}
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="backup-restore"
          title="No return requests"
          message="Requests you submit from an order will show up here."
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {fontSize: font.md, fontWeight: '700', color: colors.text},
  date: {fontSize: font.xs, color: colors.textMuted},
  reason: {fontSize: font.sm, color: colors.text, marginTop: spacing.xs, lineHeight: 20},
  noteBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteLabel: {
    fontSize: font.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  noteText: {fontSize: font.sm, color: colors.textMuted, lineHeight: 19},
  refund: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.success,
    marginTop: spacing.sm,
  },
});

export default MyReturnsScreen;
