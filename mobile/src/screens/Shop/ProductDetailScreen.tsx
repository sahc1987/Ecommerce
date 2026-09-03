import React, {useCallback, useState} from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {productsApi} from '../../api';
import {useAsync} from '../../hooks/useAsync';
import {Button, ErrorState, Icon, Loading, StatusBadge} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {effectivePrice, formatMoney, isDiscounted} from '../../utils/format';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {addItem} from '../../store/slices/cartSlice';
import type {ShopStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<ShopStackParams, 'ProductDetail'>;

const {width} = Dimensions.get('window');

const ProductDetailScreen = ({route}: Props) => {
  const {id} = route.params;
  const dispatch = useAppDispatch();
  const rootNav = useNavigation();
  const inCart = useAppSelector(
    s => s.cart.items.find(i => i.product_id === id)?.quantity ?? 0,
  );
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const run = useCallback(async () => {
    const {data} = await productsApi.detail(id);
    return data.product;
  }, [id]);

  const {data: product, loading, refreshing, error, refresh} = useAsync(run, [id]);

  if (loading) {
    return <Loading />;
  }
  if (error || !product) {
    return <ErrorState message={error ?? 'Product not found'} onRetry={refresh} />;
  }

  const images = product.images ?? [];
  const price = effectivePrice(product);
  const discounted = isDiscounted(product);
  const remaining = product.stock - inCart;
  const canAdd = remaining > 0;

  const add = () => {
    dispatch(addItem({product, quantity: Math.min(quantity, remaining)}));
    // @ts-expect-error — jumping across tab navigators is untyped here
    rootNav.navigate('CartTab', {screen: 'Cart'});
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.gallery}>
        {images.length > 0 ? (
          <>
            <Image
              source={{uri: images[activeImage]?.url}}
              style={styles.hero}
              resizeMode="cover"
            />
            {images.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}>
                {images.map((img, index) => (
                  <Pressable key={img.id} onPress={() => setActiveImage(index)}>
                    <Image
                      source={{uri: img.url}}
                      style={[
                        styles.thumb,
                        index === activeImage && styles.thumbActive,
                      ]}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <Icon name="image-off-outline" size={40} color={colors.textFaint} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        {product.category_name ? (
          <Text style={styles.breadcrumb}>
            {product.category_name}
            {product.subcategory_name ? ` · ${product.subcategory_name}` : ''}
          </Text>
        ) : null}
        <Text style={styles.name}>{product.name}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatMoney(price)}</Text>
          {discounted ? (
            <>
              <Text style={styles.strike}>{formatMoney(product.price)}</Text>
              <View style={styles.saveTag}>
                <Text style={styles.saveText}>
                  Save {Math.round(Number.parseFloat(product.discount_percent))}%
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.stockRow}>
          {product.stock > 0 ? (
            <StatusBadge status={product.stock <= 5 ? 'pending' : 'delivered'} />
          ) : (
            <StatusBadge status="cancelled" />
          )}
          <Text style={styles.stockText}>
            {product.stock > 0
              ? `${product.stock} in stock`
              : 'Currently out of stock'}
          </Text>
        </View>

        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        ) : null}

        {product.sku ? (
          <Text style={styles.sku}>SKU {product.sku}</Text>
        ) : null}

        {canAdd ? (
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                hitSlop={6}>
                <Icon name="minus" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setQuantity(q => Math.min(remaining, q + 1))}
                hitSlop={6}>
                <Icon name="plus" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {inCart > 0 ? (
          <Text style={styles.inCart}>{inCart} already in your cart</Text>
        ) : null}

        <Button
          title={canAdd ? 'Add to cart' : 'Unavailable'}
          icon="cart-plus"
          onPress={add}
          disabled={!canAdd}
          style={styles.cta}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {paddingBottom: spacing.xxl},
  gallery: {backgroundColor: colors.surface},
  hero: {width, height: width},
  heroFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbs: {padding: spacing.md, gap: spacing.sm},
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {borderColor: colors.primary},
  body: {padding: spacing.lg, gap: spacing.md},
  breadcrumb: {fontSize: font.xs, color: colors.textFaint, textTransform: 'uppercase'},
  name: {fontSize: font.xl, fontWeight: '700', color: colors.text},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  price: {fontSize: font.xxl, fontWeight: '700', color: colors.text},
  strike: {
    fontSize: font.md,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  saveTag: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  saveText: {color: colors.danger, fontSize: font.xs, fontWeight: '700'},
  stockRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  stockText: {fontSize: font.sm, color: colors.textMuted},
  section: {gap: spacing.sm, marginTop: spacing.sm},
  sectionTitle: {fontSize: font.md, fontWeight: '700', color: colors.text},
  description: {fontSize: font.sm, color: colors.textMuted, lineHeight: 21},
  sku: {fontSize: font.xs, color: colors.textFaint},
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  qtyLabel: {fontSize: font.sm, fontWeight: '600', color: colors.textMuted},
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  stepBtn: {paddingHorizontal: spacing.lg, paddingVertical: spacing.sm},
  qtyValue: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },
  inCart: {fontSize: font.xs, color: colors.textMuted},
  cta: {marginTop: spacing.md},
});

export default ProductDetailScreen;
