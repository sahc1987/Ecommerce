import React, {useEffect, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {setupApi} from '../../api';
import {errorMessage} from '../../api/client';
import {Button, Card, Field, Icon, Loading, SectionTitle} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {loadStoreSettings} from '../../store/slices/settingsSlice';

const AdminSettingsScreen = () => {
  const dispatch = useAppDispatch();
  const store = useAppSelector(s => s.settings.store);
  const isAdmin = useAppSelector(s => s.auth.user?.role === 'admin');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('0');
  const [returnDays, setReturnDays] = useState('30');
  const [loading, setLoading] = useState(!store);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!store) {
      setLoading(true);
      void dispatch(loadStoreSettings()).finally(() => setLoading(false));
      return;
    }
    setName(store.name ?? '');
    setDescription(store.description ?? '');
    setCurrency(store.currency ?? 'USD');
    setEmail(store.email ?? '');
    setPhone(store.phone ?? '');
    setAddress(store.address ?? '');
    setTaxEnabled(store.tax_enabled);
    setTaxRate(String(store.tax_rate ?? '0'));
    setReturnDays(String(store.return_window_days ?? 30));
    setLoading(false);
  }, [store, dispatch]);

  const save = async () => {
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    try {
      await setupApi.complete({
        name: name.trim(),
        description: description.trim(),
        currency: currency.trim().toUpperCase(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        tax_enabled: taxEnabled,
        tax_rate: Number.parseFloat(taxRate) || 0,
        return_window_days: Number.parseInt(returnDays, 10) || 30,
      });
      await dispatch(loadStoreSettings());
      Alert.alert('Saved', 'Store settings updated.');
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!isAdmin) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Icon name="lock-outline" size={20} color={colors.textMuted} />
          <Text style={styles.noticeText}>
            Only an admin can change store settings.
          </Text>
        </View>
        <Card>
          <Text style={styles.readonlyLabel}>Store</Text>
          <Text style={styles.readonlyValue}>{store?.name ?? '—'}</Text>
          <Text style={styles.readonlyLabel}>Currency</Text>
          <Text style={styles.readonlyValue}>{store?.currency ?? 'USD'}</Text>
          <Text style={styles.readonlyLabel}>Return window</Text>
          <Text style={styles.readonlyValue}>
            {store?.return_window_days ?? 30} days
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <SectionTitle title="Storefront" />
        <Card>
          <Field label="Store name" value={name} onChangeText={setName} />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Field
            label="Currency code"
            value={currency}
            onChangeText={text => setCurrency(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            hint="ISO code, e.g. USD, EUR, MXN."
          />
        </Card>

        <SectionTitle title="Contact" />
        <Card>
          <Field
            label="Support email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Card>

        <SectionTitle title="Policies" />
        <Card>
          <View style={styles.toggle}>
            <View style={styles.flex}>
              <Text style={styles.toggleLabel}>Charge tax</Text>
              <Text style={styles.toggleHint}>
                Applied to the order subtotal at checkout.
              </Text>
            </View>
            <Switch
              value={taxEnabled}
              onValueChange={setTaxEnabled}
              trackColor={{true: colors.primary, false: colors.border}}
            />
          </View>
          {taxEnabled ? (
            <Field
              label="Tax rate (%)"
              value={taxRate}
              onChangeText={setTaxRate}
              keyboardType="decimal-pad"
              style={styles.spaced}
            />
          ) : null}
          <Field
            label="Return window (days)"
            value={returnDays}
            onChangeText={setReturnDays}
            keyboardType="number-pad"
            hint="How long after ordering a customer may request a return."
            style={taxEnabled ? undefined : styles.spaced}
          />
        </Card>

        <Button
          title="Save settings"
          icon="content-save-outline"
          onPress={save}
          loading={saving}
          disabled={!name.trim()}
          style={styles.cta}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xxl},
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: {flex: 1, fontSize: font.sm, color: colors.textMuted},
  readonlyLabel: {
    fontSize: font.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: spacing.md,
  },
  readonlyValue: {fontSize: font.md, color: colors.text, marginTop: 2},
  toggle: {flexDirection: 'row', alignItems: 'center', gap: spacing.lg},
  toggleLabel: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  toggleHint: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  spaced: {marginTop: spacing.lg},
  cta: {marginTop: spacing.lg},
});

export default AdminSettingsScreen;
