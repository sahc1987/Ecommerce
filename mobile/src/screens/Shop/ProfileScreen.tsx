import React from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, Card, Icon, SectionTitle} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {API_URL} from '../../config';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {logout} from '../../store/slices/authSlice';
import {cartCount} from '../../store/slices/cartSlice';

const ProfileScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const user = useAppSelector(s => s.auth.user);
  const store = useAppSelector(s => s.settings.store);
  const items = useAppSelector(s => s.cart.items);

  const confirmLogout = () => {
    Alert.alert('Sign out', 'You will need to sign in again to order.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void dispatch(logout());
        },
      },
    ]);
  };

  const go = (tab: string, screen: string) => () => {
    // @ts-expect-error — cross-tab navigation is untyped here
    navigation.navigate(tab, {screen});
  };

  const initials = (user?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>{user?.role}</Text>
            </View>
          </View>
        </View>
      </Card>

      <SectionTitle title="Shortcuts" />
      <Card>
        <MenuRow
          icon="package-variant-closed"
          label="My orders"
          onPress={go('OrdersTab', 'MyOrders')}
        />
        <MenuRow
          icon="backup-restore"
          label="My returns"
          onPress={go('OrdersTab', 'MyReturns')}
        />
        <MenuRow
          icon="cart-outline"
          label="Cart"
          value={cartCount(items) > 0 ? `${cartCount(items)} items` : 'Empty'}
          onPress={go('CartTab', 'Cart')}
          last
        />
      </Card>

      {user?.role === 'admin' || user?.role === 'staff' ? (
        <>
          <SectionTitle title="Staff" />
          <Card>
            <MenuRow
              icon="view-dashboard-outline"
              label="Admin dashboard"
              onPress={go('AdminTab', 'Dashboard')}
              last
            />
          </Card>
        </>
      ) : null}

      <SectionTitle title="Store" />
      <Card>
        <InfoRow label="Name" value={store?.name ?? '—'} />
        <InfoRow label="Currency" value={store?.currency ?? 'USD'} />
        <InfoRow
          label="Return window"
          value={`${store?.return_window_days ?? 30} days`}
        />
        {store?.email ? <InfoRow label="Support" value={store.email} /> : null}
        <InfoRow label="API" value={API_URL} />
      </Card>

      <Button
        title="Sign out"
        variant="danger"
        icon="logout"
        onPress={confirmLogout}
        style={styles.logout}
      />
    </ScrollView>
  );
};

const MenuRow = ({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    style={({pressed}) => [
      styles.menuRow,
      !last && styles.menuRowBordered,
      pressed && styles.pressed,
    ]}>
    <Icon name={icon} size={20} color={colors.textMuted} />
    <Text style={styles.menuLabel}>{label}</Text>
    {value ? <Text style={styles.menuValue}>{value}</Text> : null}
    <Icon name="chevron-right" size={20} color={colors.textFaint} />
  </Pressable>
);

const InfoRow = ({label, value}: {label: string; value: string}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  flex: {flex: 1},
  identity: {flexDirection: 'row', alignItems: 'center', gap: spacing.lg},
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontSize: font.lg, fontWeight: '700', color: colors.primary},
  name: {fontSize: font.lg, fontWeight: '700', color: colors.text},
  email: {fontSize: font.sm, color: colors.textMuted, marginTop: 2},
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  menuRowBordered: {borderBottomWidth: 1, borderBottomColor: colors.border},
  pressed: {opacity: 0.6},
  menuLabel: {flex: 1, fontSize: font.md, color: colors.text},
  menuValue: {fontSize: font.sm, color: colors.textMuted},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.xs + 2,
  },
  infoLabel: {fontSize: font.sm, color: colors.textMuted},
  infoValue: {fontSize: font.sm, color: colors.text, flexShrink: 1},
  logout: {marginTop: spacing.xl},
});

export default ProfileScreen;
