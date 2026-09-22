import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Icon} from './ui';
import {colors, font, radius, spacing} from '../theme';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {lineStatus, syncReservations} from '../store/slices/cartSlice';
import {formatCountdown, useHoldCountdown} from '../hooks/useReservationSync';

/** Shows how long the cart's stock is held, or what went wrong with the hold. */
export const HoldNotice = () => {
  const dispatch = useAppDispatch();
  const {items, reservations, holdStatus, syncing} = useAppSelector(s => s.cart);
  const left = useHoldCountdown();

  if (items.length === 0) {
    return null;
  }

  const problems = items.filter(i =>
    ['partial', 'unavailable'].includes(lineStatus(i, reservations[i.product_id], holdStatus)),
  );

  if (holdStatus === 'expired') {
    return (
      <View style={[styles.box, styles.warn]}>
        <Icon name="alert-outline" size={16} color={colors.warning} />
        <Text style={[styles.text, styles.warnText]}>
          Your hold expired — items may have sold out.
        </Text>
        <Pressable
          onPress={() => void dispatch(syncReservations())}
          disabled={syncing}
          hitSlop={6}>
          <Text style={styles.action}>{syncing ? 'Checking…' : 'Reserve again'}</Text>
        </Pressable>
      </View>
    );
  }

  if (problems.length > 0) {
    return (
      <View style={[styles.box, styles.danger, styles.column]}>
        <View style={styles.row}>
          <Icon name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={[styles.text, styles.dangerText, styles.bold]}>
            Some items are no longer available
          </Text>
        </View>
        {problems.map(i => {
          const r = reservations[i.product_id];
          return (
            <Text key={i.product_id} style={[styles.text, styles.dangerText, styles.detail]}>
              • {i.name}: {r?.reserved ? `only ${r.reserved} available` : 'out of stock'}
            </Text>
          );
        })}
      </View>
    );
  }

  if (left === null) {
    return null;
  }

  return (
    <View style={[styles.box, styles.info]}>
      <Icon name="timer-outline" size={16} color={colors.primary} />
      <Text style={[styles.text, styles.infoText]}>
        Items reserved for <Text style={styles.bold}>{formatCountdown(left)}</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  column: {flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs},
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  text: {flex: 1, fontSize: font.sm},
  bold: {fontWeight: '700'},
  detail: {fontSize: font.xs, marginLeft: spacing.lg},
  action: {fontSize: font.sm, fontWeight: '700', color: colors.warning},
  info: {backgroundColor: colors.primarySoft, borderColor: colors.primarySoft},
  infoText: {color: colors.primary},
  warn: {backgroundColor: colors.warningSoft, borderColor: colors.warningSoft},
  warnText: {color: colors.warning},
  danger: {backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft},
  dangerText: {color: colors.danger},
});
