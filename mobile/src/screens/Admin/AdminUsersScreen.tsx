import React, {useCallback, useEffect, useState} from 'react';
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
import {usersApi} from '../../api';
import {errorMessage} from '../../api/client';
import {useAsync} from '../../hooks/useAsync';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Loading,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatDate} from '../../utils/format';
import {useAppSelector} from '../../store/hooks';
import type {Role, User} from '../../types';

const ROLES: Role[] = ['customer', 'staff', 'admin'];

const AdminUsersScreen = () => {
  const currentUserId = useAppSelector(s => s.auth.user?.id);
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | null>(null);

  const [active, setActive] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(rawSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  const run = useCallback(async () => {
    const {data} = await usersApi.list({
      ...(search ? {search} : {}),
      ...(roleFilter ? {role: roleFilter} : {}),
    });
    return data.users;
  }, [search, roleFilter]);

  const {data: users, loading, refreshing, error, refresh} = useAsync(run, [
    search,
    roleFilter,
  ]);

  const openEdit = (user: User) => {
    setActive(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setIsActive(user.is_active ?? true);
    setPassword('');
  };

  const save = async () => {
    if (!active) {
      return;
    }
    setSaving(true);
    try {
      await usersApi.update(active.id, {
        name: name.trim(),
        email: email.trim(),
        role,
        is_active: isActive,
        ...(password ? {password} : {}),
      });
      setActive(null);
      await refresh();
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = (user: User) => {
    Alert.alert(
      'Deactivate account',
      `${user.name} will no longer be able to sign in.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.remove(user.id);
              await refresh();
            } catch (err) {
              Alert.alert('Could not deactivate', errorMessage(err));
            }
          },
        },
      ],
    );
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
        data={users ?? []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View>
            <Field
              value={rawSearch}
              onChangeText={setRawSearch}
              placeholder="Search by name or email"
              autoCapitalize="none"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              <Chip
                label="All"
                active={roleFilter === null}
                onPress={() => setRoleFilter(null)}
              />
              {ROLES.map(r => (
                <Chip
                  key={r}
                  label={r}
                  active={roleFilter === r}
                  onPress={() => setRoleFilter(r)}
                />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({item}) => (
          <Pressable style={styles.card} onPress={() => openEdit(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.tags}>
                <Text style={styles.role}>{item.role}</Text>
                <Text style={styles.meta}>{item.order_count ?? 0} orders</Text>
                {item.created_at ? (
                  <Text style={styles.meta}>
                    joined {formatDate(item.created_at)}
                  </Text>
                ) : null}
                {item.is_active === false ? (
                  <Text style={styles.inactive}>inactive</Text>
                ) : null}
              </View>
            </View>
            {item.id !== currentUserId && item.is_active !== false ? (
              <Pressable hitSlop={8} onPress={() => confirmDeactivate(item)}>
                <Icon name="account-off-outline" size={20} color={colors.danger} />
              </Pressable>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="account-search-outline"
            title="No customers"
            message={search ? 'Nothing matches that search.' : 'No accounts yet.'}
          />
        }
      />

      <Modal visible={!!active} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit account</Text>
            <Field label="Name" value={name} onChangeText={setName} />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.pickerLabel}>Role</Text>
            <View style={styles.chipWrap}>
              {ROLES.map(r => (
                <Chip
                  key={r}
                  label={r}
                  active={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </View>
            <View style={styles.toggle}>
              <Text style={styles.toggleLabel}>Account active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{true: colors.primary, false: colors.border}}
              />
            </View>
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="Leave blank to keep the current one"
              secureTextEntry
              autoCapitalize="none"
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontSize: font.md, fontWeight: '700', color: colors.primary},
  body: {flex: 1, gap: 2},
  name: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  email: {fontSize: font.xs, color: colors.textMuted},
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  role: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  meta: {fontSize: font.xs, color: colors.textFaint},
  inactive: {fontSize: font.xs, color: colors.danger, fontWeight: '600'},
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
  pickerLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  toggleLabel: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  modalActions: {flexDirection: 'row', gap: spacing.md},
});

export default AdminUsersScreen;
