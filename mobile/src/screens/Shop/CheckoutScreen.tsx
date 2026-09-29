import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
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
import {
  cartBlocked,
  cartSignature,
  cartSubtotal,
  clearCart,
  renewReservations,
  syncReservations,
} from '../../store/slices/cartSlice';
import {HoldNotice} from '../../components/HoldNotice';
import {newIdempotencyKey} from '../../utils/storage';
import type {CartStackParams} from '../../navigation/types';
import type {PaymentMethod, ShippingAddress} from '../../types';

type Props = NativeStackScreenProps<CartStackParams, 'Checkout'>;

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    value: 'stripe',
    label: 'Credit or debit card',
    hint: 'Pay securely with Stripe',
    icon: 'credit-card-outline',
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    hint: 'Pay when your order arrives',
    icon: 'cash',
  },
];

/** A card order waiting for the customer to finish paying in the browser. */
type PendingPayment = {orderId: string; url: string};

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
  const cart = useAppSelector(s => s.cart);
  const {items} = cart;
  const blocked = cartBlocked(cart);
  const user = useAppSelector(s => s.auth.user);

  // One key per checkout attempt: a retried submit reuses it (the server
  // de-duplicates); a changed cart gets a new one since the body would differ.
  const signature = cartSignature(items);
  const idempotencyKey = useRef(newIdempotencyKey());
  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
  }, [signature]);

  // Being on the checkout screen keeps the stock hold alive.
  useEffect(() => {
    void dispatch(renewReservations());
    const id = setInterval(() => void dispatch(renewReservations()), 60_000);
    return () => clearInterval(id);
  }, [dispatch]);
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
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    paymentsApi
      .config()
      .then(({data}) => {
        if (data.stripe_enabled) {
          setStripeEnabled(true);
          setPaymentMethod('stripe');
        }
      })
      .catch(() => {});
  }, []);

  // The card order is gone (canceled or expired): start a fresh attempt.
  const resetAttempt = useCallback(() => {
    setPending(null);
    idempotencyKey.current = newIdempotencyKey();
    void dispatch(syncReservations());
  }, [dispatch]);

  const checkPayment = useCallback(
    async (orderId: string) => {
      setChecking(true);
      try {
        const {data} = await paymentsApi.confirm(orderId);
        if (data.payment_status === 'paid') {
          dispatch(clearCart());
          navigation.replace('OrderSuccess', {orderId});
        } else if (data.status === 'cancelled') {
          setError('The payment session expired. Please try again.');
          resetAttempt();
        }
      } catch (err) {
        setError(errorMessage(err, 'Could not check your payment'));
      } finally {
        setChecking(false);
      }
    },
    [dispatch, navigation, resetAttempt],
  );

  // Coming back from the browser: see whether the payment went through.
  useEffect(() => {
    if (!pending) {
      return;
    }
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void checkPayment(pending.orderId);
      }
    });
    return () => sub.remove();
  }, [pending, checkPayment]);

  const cancelPayment = async () => {
    if (!pending) {
      return;
    }
    setChecking(true);
    try {
      const {data} = await paymentsApi.cancel(pending.orderId);
      if (data.payment_status === 'paid') {
        dispatch(clearCart());
        navigation.replace('OrderSuccess', {orderId: pending.orderId});
        return;
      }
      resetAttempt();
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel the payment'));
    } finally {
      setChecking(false);
    }
  };

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
    if (missing.length > 0 || items.length === 0 || blocked || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const {data} = await paymentsApi.placeOrder(
        {
          items: items.map(i => ({product_id: i.product_id, quantity: i.quantity})),
          shipping_address: address,
          notes: notes.trim() || undefined,
          payment_method: paymentMethod,
        },
        idempotencyKey.current,
      );
      if (data.checkout_url) {
        // The cart is kept until Stripe confirms payment.
        setPending({orderId: data.order_id, url: data.checkout_url});
        await Linking.openURL(data.checkout_url);
        return;
      }
      dispatch(clearCart());
      navigation.replace('OrderSuccess', {orderId: data.order_id});
    } catch (err) {
      setError(errorMessage(err, 'Could not place your order'));
      const status = (err as {response?: {status?: number}})?.response?.status;
      if (status === 409) {
        // Stock changed under us: refresh holds so the cart shows what's left.
        void dispatch(syncReservations());
      } else if (status === 422) {
        idempotencyKey.current = newIdempotencyKey();
      }
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

        <HoldNotice />

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

        <SectionTitle title="Payment method" />
        <Card>
          {PAYMENT_OPTIONS.filter(o => o.value !== 'stripe' || stripeEnabled).map(
            o => {
              const selected = paymentMethod === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{checked: selected, disabled: !!pending}}
                  disabled={!!pending}
                  onPress={() => setPaymentMethod(o.value)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    <Text style={styles.optionHint}>{o.hint}</Text>
                  </View>
                  <Icon
                    name={o.icon}
                    size={22}
                    color={selected ? colors.primary : colors.textFaint}
                  />
                </Pressable>
              );
            },
          )}
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

        {pending ? (
          <Card style={styles.cta}>
            <View style={styles.pendingHeader}>
              <Icon name="credit-card-clock-outline" size={22} color={colors.primary} />
              <Text style={styles.pendingTitle}>Finish paying in your browser</Text>
            </View>
            <Text style={styles.pendingText}>
              Complete the payment on Stripe's page, then come back here. We'll
              confirm it automatically.
            </Text>
            <Button
              title="I've paid — check status"
              icon="refresh"
              onPress={() => void checkPayment(pending.orderId)}
              loading={checking}
              style={styles.pendingButton}
            />
            <Button
              title="Open payment page again"
              icon="open-in-new"
              variant="secondary"
              onPress={() => void Linking.openURL(pending.url)}
              disabled={checking}
              style={styles.pendingButton}
            />
            <Button
              title="Cancel payment"
              variant="ghost"
              onPress={cancelPayment}
              disabled={checking}
              style={styles.pendingButton}
            />
          </Card>
        ) : (
          <Button
            title={paymentMethod === 'stripe' ? 'Pay with card' : 'Place order'}
            icon={paymentMethod === 'stripe' ? 'lock' : 'check'}
            onPress={placeOrder}
            loading={submitting}
            disabled={items.length === 0 || blocked}
            style={styles.cta}
          />
        )}
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  optionSelected: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {borderColor: colors.primary},
  radioDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary},
  optionLabel: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  optionHint: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  pendingHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  pendingTitle: {fontSize: font.md, fontWeight: '700', color: colors.text, flex: 1},
  pendingText: {fontSize: font.sm, color: colors.textMuted, marginVertical: spacing.sm},
  pendingButton: {marginTop: spacing.sm},
});

export default CheckoutScreen;
