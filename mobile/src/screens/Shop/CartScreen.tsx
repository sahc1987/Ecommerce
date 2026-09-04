import React from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {Button, EmptyState, Icon, Row} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatMoney} from '../../utils/format';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {
  cartSubtotal,
  removeItem,
  setQuantity,
} from '../../store/slices/cartSlice';
import type {CartStackParams} from '../../navigation/types';
import {mediaUrl} from '../../utils/media';

type Props = NativeStackScreenProps<CartStackParams, 'Cart'>;

const CartScreen = ({navigation}: Props) => {
  const dispatch = useAppDispatch();
  const rootNav = useNavigation();
  const items = useAppSelector(s => s.cart.items);
  const subtotal = cartSubtotal(items);

  if (items.length === 0) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Your cart is empty"
        message="Browse the shop and add something you like."
        action={
          <Button
            title="Go shopping"
            variant="secondary"
            onPress={() =>
              // @ts-expect-error — cross-tab navigation is untyped here
              rootNav.navigate('ShopTab', {screen: 'Home'})
            }
          />
        }
      />
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={item => item.product_id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <View style={styles.item}>
            {item.image ? (
              <Image source={{uri: mediaUrl(item.image)}} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imageFallback]}>
                <Icon name="image-outline" size={20} color={colors.textFaint} />
              </View>
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatMoney(item.price)} each</Text>
              <View style={styles.itemFooter}>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepBtn}
                    hitSlop={6}
                    onPress={() =>
                      dispatch(
                        setQuantity({
                          product_id: item.product_id,
                          quantity: item.quantity - 1,
                        }),
                      )
                    }>
                    <Icon name="minus" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Pressable
                    style={styles.stepBtn}
                    hitSlop={6}
                    disabled={item.quantity >= item.stock}
                    onPress={() =>
                      dispatch(
                        setQuantity({
                          product_id: item.product_id,
                          quantity: item.quantity + 1,
                        }),
                      )
                    }>
                    <Icon
                      name="plus"
                      size={16}
                      color={
                        item.quantity >= item.stock ? colors.textFaint : colors.text
                      }
                    />
                  </Pressable>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => dispatch(removeItem(item.product_id))}>
                  <Icon name="trash-can-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
              {item.quantity >= item.stock ? (
                <Text style={styles.stockNote}>Max stock reached</Text>
              ) : null}
            </View>
            <Text style={styles.lineTotal}>
              {formatMoney(item.price * item.quantity)}
            </Text>
          </View>
        )}
      />

      <View style={styles.summary}>
        <Row label="Subtotal" value={formatMoney(subtotal)} />
        <Row label="Shipping" value="Free" />
        <View style={styles.divider} />
        <Row label="Total" value={formatMoney(subtotal)} strong />
        <Text style={styles.taxNote}>
          Tax, if any, is calculated by the store at checkout.
        </Text>
        <Button
          title="Proceed to checkout"
          icon="arrow-right"
          onPress={() => navigation.navigate('Checkout')}
          style={styles.cta}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, gap: spacing.md},
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  image: {width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt},
  imageFallback: {alignItems: 'center', justifyContent: 'center'},
  itemBody: {flex: 1, gap: spacing.xs},
  itemName: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  itemPrice: {fontSize: font.xs, color: colors.textMuted},
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  stepBtn: {paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2},
  qty: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.text,
  },
  stockNote: {fontSize: font.xs, color: colors.warning},
  lineTotal: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  summary: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
  },
  divider: {height: 1, backgroundColor: colors.border, marginVertical: spacing.sm},
  taxNote: {fontSize: font.xs, color: colors.textFaint, marginTop: spacing.xs},
  cta: {marginTop: spacing.md},
});

export default CartScreen;
