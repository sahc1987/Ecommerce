import React, {useEffect} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {Button, EmptyState, Icon, Row} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatMoney} from '../../utils/format';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {
  cartBlocked,
  cartSubtotal,
  lineStatus,
  removeItem,
  type LineStatus,
  renewReservations,
  setQuantity,
} from '../../store/slices/cartSlice';
import {HoldNotice} from '../../components/HoldNotice';
import type {CartStackParams} from '../../navigation/types';
import {mediaUrl} from '../../utils/media';

type Props = NativeStackScreenProps<CartStackParams, 'Cart'>;

const CartScreen = ({navigation}: Props) => {
  const dispatch = useAppDispatch();
  const rootNav = useNavigation();
  const cart = useAppSelector(s => s.cart);
  const {items, reservations, holdStatus} = cart;
  const subtotal = cartSubtotal(items);
  const blocked = cartBlocked(cart);

  // Opening the cart counts as activity: extend the stock hold.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => void dispatch(renewReservations()));
    void dispatch(renewReservations());
    return unsub;
  }, [navigation, dispatch]);

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
        ListHeaderComponent={<HoldNotice />}
        renderItem={({item}) => {
          const status = lineStatus(item, reservations[item.product_id], holdStatus);
          const held = reservations[item.product_id]?.reserved ?? 0;
          return (
          <View style={[styles.item, status !== 'ok' && status !== 'pending' && styles.itemProblem]}>
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
              <LineNote status={status} held={held} />
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
          );
        }}
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
          title={blocked ? 'Fix cart to continue' : 'Proceed to checkout'}
          icon="arrow-right"
          disabled={blocked}
          onPress={() => navigation.navigate('Checkout')}
          style={styles.cta}
        />
      </View>
    </View>
  );
};

/** Explains why a cart line can't be bought as-is; nothing for healthy lines. */
const LineNote = ({status, held}: Readonly<{status: LineStatus; held: number}>) => {
  if (status === 'unavailable') {
    return <Text style={styles.problemNote}>Out of stock — reserved by another shopper</Text>;
  }
  if (status === 'partial') {
    return <Text style={styles.problemNote}>Only {held} available — reduce quantity</Text>;
  }
  if (status === 'expired') {
    return <Text style={styles.stockNote}>Hold expired</Text>;
  }
  return null;
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
  problemNote: {fontSize: font.xs, color: colors.danger, fontWeight: '600'},
  itemProblem: {borderColor: colors.danger, backgroundColor: colors.dangerSoft},
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
