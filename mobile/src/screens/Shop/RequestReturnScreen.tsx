import React, {useCallback, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ordersApi, returnsApi} from '../../api';
import {errorMessage} from '../../api/client';
import {useAsync} from '../../hooks/useAsync';
import {Button, Card, ErrorState, Field, Icon, Loading, SectionTitle} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatMoney, shortId} from '../../utils/format';
import type {OrdersStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParams, 'RequestReturn'>;

const RequestReturnScreen = ({route, navigation}: Props) => {
  const {orderId} = route.params;
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const run = useCallback(async () => {
    const {data} = await ordersApi.detail(orderId);
    return data.order;
  }, [orderId]);

  const {data: order, loading, error, refresh} = useAsync(run, [orderId], {
    refetchOnFocus: false,
  });

  if (loading) {
    return <Loading />;
  }
  if (error || !order) {
    return <ErrorState message={error ?? 'Order not found'} onRetry={refresh} />;
  }

  const items = order.items ?? [];
  const chosen = items.filter(i => selected[i.id]);

  const submit = async () => {
    setTouched(true);
    if (reason.trim().length < 10) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await returnsApi.create({
        order_id: orderId,
        reason: reason.trim(),
        items: chosen.map(i => ({order_item_id: i.id, quantity: i.quantity})),
      });
      navigation.replace('MyReturns');
    } catch (err) {
      setSubmitError(errorMessage(err, 'Could not submit your return request'));
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
        <Text style={styles.intro}>
          Tell us what went wrong with order #{shortId(orderId)}. The store reviews
          every request before issuing a refund.
        </Text>

        {submitError ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <SectionTitle title="Items to return" />
        <Card>
          <Text style={styles.hint}>
            Optional — leave everything unselected to return the whole order.
          </Text>
          {items.map(item => {
            const isOn = !!selected[item.id];
            return (
              <Pressable
                key={item.id}
                style={styles.itemRow}
                onPress={() =>
                  setSelected(prev => ({...prev, [item.id]: !prev[item.id]}))
                }>
                <Icon
                  name={isOn ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={isOn ? colors.primary : colors.textFaint}
                />
                <View style={styles.flex}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.quantity} × {formatMoney(item.unit_price)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>

        <SectionTitle title="Reason" />
        <Card>
          <Field
            value={reason}
            onChangeText={setReason}
            placeholder="Describe the problem in a sentence or two"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            error={
              touched && reason.trim().length < 10
                ? 'Please give at least a short explanation.'
                : null
            }
            style={styles.reasonField}
          />
        </Card>

        <Button
          title="Submit return request"
          icon="send-outline"
          onPress={submit}
          loading={submitting}
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
  intro: {fontSize: font.sm, color: colors.textMuted, lineHeight: 20},
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {color: colors.danger, fontSize: font.sm, flex: 1},
  hint: {fontSize: font.xs, color: colors.textFaint, marginBottom: spacing.sm},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemName: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  itemMeta: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  reasonField: {marginBottom: 0},
  cta: {marginTop: spacing.lg},
});

export default RequestReturnScreen;
