import React, {useCallback} from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {dashboardApi} from '../../api';
import {useAsync} from '../../hooks/useAsync';
import {
  Card,
  ErrorState,
  Icon,
  Loading,
  SectionTitle,
  StatusBadge,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDate, formatMoney, shortId} from '../../utils/format';
import type {AdminStackParams} from '../../navigation/types';
import {mediaUrl} from '../../utils/media';

type Props = NativeStackScreenProps<AdminStackParams, 'Dashboard'>;

const DashboardScreen = ({navigation}: Props) => {
  const run = useCallback(async () => {
    const [summary, chart, recent, top] = await Promise.all([
      dashboardApi.summary(),
      dashboardApi.salesChart(),
      dashboardApi.recentOrders(),
      dashboardApi.topProducts(),
    ]);
    return {
      summary: summary.data,
      chart: chart.data.chart,
      recent: recent.data.orders,
      top: top.data.products,
    };
  }, []);

  const {data, loading, refreshing, error, refresh} = useAsync(run, []);

  if (loading) {
    return <Loading />;
  }
  if (error || !data) {
    return <ErrorState message={error ?? 'Could not load dashboard'} onRetry={refresh} />;
  }

  const {summary, chart, recent, top} = data;
  const peak = Math.max(
    ...chart.map(p => Number.parseFloat(p.revenue)),
    1,
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.tiles}>
        <Tile
          icon="cash-multiple"
          label="Revenue"
          value={formatMoney(summary.total_revenue)}
          tone={colors.success}
        />
        <Tile
          icon="receipt"
          label="Orders"
          value={String(summary.total_orders)}
          tone={colors.primary}
        />
        <Tile
          icon="account-group-outline"
          label="Customers"
          value={String(summary.total_customers)}
          tone={colors.info}
        />
        <Tile
          icon="tag-outline"
          label="Active products"
          value={String(summary.active_products)}
          tone={colors.warning}
        />
      </View>

      {summary.pending_shipments > 0 || summary.pending_returns > 0 ? (
        <View style={styles.alerts}>
          {summary.pending_shipments > 0 ? (
            <Pressable
              style={styles.alert}
              onPress={() => navigation.navigate('AdminOrders', {status: 'paid'})}>
              <Icon name="truck-alert-outline" size={20} color={colors.warning} />
              <Text style={styles.alertText}>
                {summary.pending_shipments} order
                {summary.pending_shipments === 1 ? '' : 's'} awaiting shipment
              </Text>
              <Icon name="chevron-right" size={18} color={colors.warning} />
            </Pressable>
          ) : null}
          {summary.pending_returns > 0 ? (
            <Pressable
              style={styles.alert}
              onPress={() => navigation.navigate('AdminReturns')}>
              <Icon name="backup-restore" size={20} color={colors.warning} />
              <Text style={styles.alertText}>
                {summary.pending_returns} return request
                {summary.pending_returns === 1 ? '' : 's'} to review
              </Text>
              <Icon name="chevron-right" size={18} color={colors.warning} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SectionTitle title="Manage" />
      <View style={styles.grid}>
        <NavTile
          icon="tag-multiple-outline"
          label="Products"
          onPress={() => navigation.navigate('AdminProducts')}
        />
        <NavTile
          icon="shape-outline"
          label="Categories"
          onPress={() => navigation.navigate('AdminCategories')}
        />
        <NavTile
          icon="receipt-text-outline"
          label="Orders"
          onPress={() => navigation.navigate('AdminOrders')}
        />
        <NavTile
          icon="backup-restore"
          label="Returns"
          onPress={() => navigation.navigate('AdminReturns')}
        />
        <NavTile
          icon="account-group-outline"
          label="Customers"
          onPress={() => navigation.navigate('AdminUsers')}
        />
        <NavTile
          icon="cog-outline"
          label="Settings"
          onPress={() => navigation.navigate('AdminSettings')}
        />
      </View>

      <SectionTitle title="Revenue, last 30 days" />
      <Card>
        {chart.length === 0 ? (
          <Text style={styles.empty}>No sales in this period yet.</Text>
        ) : (
          <View style={styles.chart}>
            {chart.map(point => {
              const revenue = Number.parseFloat(point.revenue);
              return (
                <View key={point.date} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      {height: `${Math.max(4, (revenue / peak) * 100)}%`},
                    ]}
                  />
                </View>
              );
            })}
          </View>
        )}
        {chart.length > 0 ? (
          <View style={styles.chartFooter}>
            <Text style={styles.chartMeta}>{formatDate(chart[0].date)}</Text>
            <Text style={styles.chartMeta}>Peak {formatMoney(peak)}</Text>
            <Text style={styles.chartMeta}>
              {formatDate(chart[chart.length - 1].date)}
            </Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle
        title="Recent orders"
        action={
          <Pressable onPress={() => navigation.navigate('AdminOrders')}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        }
      />
      <Card>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No orders yet.</Text>
        ) : (
          recent.map((order, index) => (
            <Pressable
              key={order.id}
              style={[styles.row, index > 0 && styles.rowBordered]}
              onPress={() =>
                navigation.navigate('AdminOrderDetail', {id: order.id})
              }>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>#{shortId(order.id)}</Text>
                <Text style={styles.rowMeta}>
                  {order.customer_name ?? 'Guest'} · {formatDate(order.created_at)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{formatMoney(order.total)}</Text>
                <StatusBadge status={order.status} />
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <SectionTitle title="Top sellers" />
      <Card>
        {top.length === 0 ? (
          <Text style={styles.empty}>Nothing sold yet.</Text>
        ) : (
          top.map((product, index) => (
            <View
              key={product.id}
              style={[styles.row, index > 0 && styles.rowBordered]}>
              {product.image ? (
                <Image source={{uri: mediaUrl(product.image)}} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="image-outline" size={16} color={colors.textFaint} />
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.rowMeta}>{product.units_sold} sold</Text>
              </View>
              <Text style={styles.rowValue}>{formatMoney(product.revenue)}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
};

const Tile = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
}) => (
  <View style={styles.tile}>
    <Icon name={icon} size={22} color={tone} />
    <Text style={styles.tileValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

const NavTile = ({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({pressed}) => [styles.navTile, pressed && styles.pressed]}>
    <Icon name={icon} size={24} color={colors.primary} />
    <Text style={styles.navLabel}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  flex: {flex: 1},
  tiles: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md},
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tileValue: {fontSize: font.xl, fontWeight: '700', color: colors.text},
  tileLabel: {fontSize: font.xs, color: colors.textMuted},
  alerts: {gap: spacing.sm, marginTop: spacing.lg},
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  alertText: {flex: 1, fontSize: font.sm, color: colors.warning, fontWeight: '600'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md},
  navTile: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  navLabel: {fontSize: font.xs, fontWeight: '600', color: colors.text},
  pressed: {opacity: 0.6},
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 2,
  },
  barSlot: {flex: 1, height: '100%', justifyContent: 'flex-end'},
  bar: {backgroundColor: colors.primary, borderRadius: 2, width: '100%'},
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  chartMeta: {fontSize: font.xs, color: colors.textFaint},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBordered: {borderTopWidth: 1, borderTopColor: colors.border},
  rowTitle: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  rowMeta: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  rowRight: {alignItems: 'flex-end', gap: spacing.xs},
  rowValue: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  thumb: {width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt},
  thumbFallback: {alignItems: 'center', justifyContent: 'center'},
  empty: {fontSize: font.sm, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.md},
  link: {color: colors.primary, fontWeight: '600', fontSize: font.sm},
});

export default DashboardScreen;
