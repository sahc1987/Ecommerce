import React, {useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {paymentsApi} from '../../api';
import {errorMessage} from '../../api/client';
import {Button, Card, Field, Icon, Row, SectionTitle} from '../../components/ui';
import {colors, font, spacing} from '../../theme';
import {formatMoney} from '../../utils/format';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {cartSubtotal, clearCart} from '../../store/slices/cartSlice';
import type {CartStackParams} from '../../navigation/types';
import type {ShippingAddress} from '../../types';

type Props = NativeStackScreenProps<CartStackParams, 'Checkout'>;

const REQUIRED: (keyof ShippingAddress)[] = [
  'name',
  'line1',
  'city',
  'state',
  'zip',
  'country',
];

const CheckoutScreen = ({navigation}: Props) => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(s => s.cart.items);
  const user = useAppSelector(s => s.auth.user);
  const store = useAppSelector(s => s.settings.store);

  const [address, setAddress] = useState<ShippingAddress>({
    name: user?.name ?? '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const subtotal = cartSubtotal(items);
  const taxRate = store?.tax_enabled ? Number.parseFloat(store.tax_rate) : 0;
  // Preview only — the server recomputes every figure when it creates the order.
  const estimatedTax = subtotal * (taxRate / 100);
  const estimatedTotal = subtotal + estimatedTax;

  const missing = useMemo(
    () => REQUIRED.filter(key => address[key].trim().length === 0),
    [address],
  );

  const set = (key: keyof ShippingAddress) => (value: string) =>
    setAddress(prev => ({...prev, [key]: value}));

  const fieldError = (key: keyof ShippingAddress) =>
    touched && missing.includes(key) ? 'Required' : null;

  const placeOrder = async () => {
    setTouched(true);
    if (missing.length > 0 || items.length === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const {data} = await paymentsApi.placeOrder({
        items: items.map(i => ({product_id: i.product_id, quantity: i.quantity})),
        shipping_address: address,
        notes: notes.trim() || undefined,
      });
      dispatch(clearCart());
      navigation.replace('OrderSuccess', {orderId: data.order_id});
    } catch (err) {
      setError(errorMessage(err, 'Could not place your order'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <SectionTitle title="Shipping address" />
        <Card>
          <Field
            label="Full name"
            value={address.name}
            onChangeText={set('name')}
            placeholder="Jane Doe"
            error={fieldError('name')}
          />
          <Field
            label="Address line 1"
            value={address.line1}
            onChangeText={set('line1')}
            placeholder="123 Main St"
            error={fieldError('line1')}
          />
          <Field
            label="Address line 2"
            value={address.line2}
            onChangeText={set('line2')}
            placeholder="Apartment, suite (optional)"
          />
          <View style={styles.split}>
            <Field
              label="City"
              value={address.city}
              onChangeText={set('city')}
              placeholder="Austin"
              error={fieldError('city')}
              style={styles.splitItem}
            />
            <Field
              label="State"
              value={address.state}
              onChangeText={set('state')}
              placeholder="TX"
              error={fieldError('state')}
              style={styles.splitItem}
            />
          </View>
          <View style={styles.split}>
            <Field
              label="ZIP / Postal code"
              value={address.zip}
              onChangeText={set('zip')}
              placeholder="78701"
              error={fieldError('zip')}
              style={styles.splitItem}
            />
            <Field
              label="Country"
              value={address.country}
              onChangeText={text => set('country')(text.toUpperCase())}
              placeholder="US"
              autoCapitalize="characters"
              maxLength={2}
              error={fieldError('country')}
              style={styles.splitItem}
            />
          </View>
          <Field
            label="Order notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Delivery instructions (optional)"
            multiline
            numberOfLines={3}
          />
        </Card>

        <SectionTitle title="Order summary" />
        <Card>
          {items.map(item => (
            <View key={item.product_id} style={styles.line}>
              <Text style={styles.lineName} numberOfLines={1}>
                {item.quantity} × {item.name}
              </Text>
              <Text style={styles.lineValue}>
                {formatMoney(item.price * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Subtotal" value={formatMoney(subtotal)} />
          <Row label="Shipping" value="Free" />
          {taxRate > 0 ? (
            <Row
              label={`Estimated tax (${taxRate}%)`}
              value={formatMoney(estimatedTax)}
            />
          ) : null}
          <View style={styles.divider} />
          <Row label="Total" value={formatMoney(estimatedTotal)} strong />
          <Text style={styles.note}>
            Final totals are confirmed by the store when the order is created.
          </Text>
        </Card>

        <Button
          title="Place order"
          icon="check"
          onPress={placeOrder}
          loading={submitting}
          disabled={items.length === 0}
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {color: colors.danger, fontSize: font.sm, flex: 1},
  split: {flexDirection: 'row', gap: spacing.md},
  splitItem: {flex: 1},
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  lineName: {flex: 1, fontSize: font.sm, color: colors.textMuted},
  lineValue: {fontSize: font.sm, color: colors.text, fontWeight: '600'},
  divider: {height: 1, backgroundColor: colors.border, marginVertical: spacing.sm},
  note: {fontSize: font.xs, color: colors.textFaint, marginTop: spacing.sm},
  cta: {marginTop: spacing.lg},
});

export default CheckoutScreen;
