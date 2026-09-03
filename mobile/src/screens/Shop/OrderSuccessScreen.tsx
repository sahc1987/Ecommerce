import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {Button, Icon} from '../../components/ui';
import {colors, font, spacing} from '../../theme';
import {shortId} from '../../utils/format';
import type {CartStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<CartStackParams, 'OrderSuccess'>;

const OrderSuccessScreen = ({route, navigation}: Props) => {
  const {orderId} = route.params;
  const rootNav = useNavigation();

  const viewOrder = () => {
    // @ts-expect-error — cross-tab navigation is untyped here
    rootNav.navigate('OrdersTab', {
      screen: 'OrderDetail',
      params: {id: orderId},
    });
    navigation.popToTop();
  };

  const keepShopping = () => {
    // @ts-expect-error — cross-tab navigation is untyped here
    rootNav.navigate('ShopTab', {screen: 'Home'});
    navigation.popToTop();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Icon name="check" size={40} color={colors.success} />
      </View>
      <Text style={styles.title}>Order placed</Text>
      <Text style={styles.subtitle}>
        Thanks! We have received your order and will email you as it moves along.
      </Text>
      <View style={styles.idBox}>
        <Text style={styles.idLabel}>Order number</Text>
        <Text style={styles.idValue}>#{shortId(orderId)}</Text>
      </View>
      <Button title="View order" icon="receipt" onPress={viewOrder} style={styles.cta} />
      <Button
        title="Continue shopping"
        variant="secondary"
        onPress={keepShopping}
        style={styles.cta}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {fontSize: font.xxl, fontWeight: '700', color: colors.text},
  subtitle: {
    fontSize: font.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  idBox: {
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: spacing.xs,
  },
  idLabel: {fontSize: font.xs, color: colors.textFaint, textTransform: 'uppercase'},
  idValue: {fontSize: font.xl, fontWeight: '700', color: colors.text, letterSpacing: 1},
  cta: {alignSelf: 'stretch', marginTop: spacing.md},
});

export default OrderSuccessScreen;
