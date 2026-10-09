import React, {useCallback, useEffect, useState} from 'react';
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
import {applyDiscount, effectivePriceRange, formatMoney, sellableStock} from '../../utils/format';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {addItem, lineKey} from '../../store/slices/cartSlice';
import type {ShopStackParams} from '../../navigation/types';
import type {ProductImage, ProductOption, Variant} from '../../types';
import {mediaUrl} from '../../utils/media';
import {
  findVariant,
  initialSelection,
  valueState,
  type Selection,
} from '../../utils/variants';

type Props = NativeStackScreenProps<ShopStackParams, 'ProductDetail'>;

const {width} = Dimensions.get('window');

const Gallery = ({
  images,
  active,
  onSelect,
}: Readonly<{
  images: ProductImage[];
  active: number;
  onSelect: (index: number) => void;
}>) => {
  if (images.length === 0) {
    return (
      <View style={[styles.hero, styles.heroFallback]}>
        <Icon name="image-off-outline" size={40} color={colors.textFaint} />
      </View>
    );
  }
  return (
    <>
      <Image
        source={{uri: mediaUrl(images[active]?.url)}}
        style={styles.hero}
        resizeMode="cover"
      />
      {images.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbs}>
          {images.map((img, index) => (
            <Pressable key={img.id} onPress={() => onSelect(index)}>
              <Image
                source={{uri: mediaUrl(img.url)}}
                style={[styles.thumb, index === active && styles.thumbActive]}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
};

const stockLabel = (sellable: number, stock: number) => {
  if (sellable > 0) {
    return `${sellable} in stock`;
  }
  // Units exist but other carts are holding them.
  if (sellable < stock) {
    return 'Out of stock — reserved by other shoppers';
  }
  return 'Currently out of stock';
};

const stockBadge = (sellable: number) => {
  if (sellable <= 0) {
    return 'cancelled';
  }
  return sellable <= 5 ? 'pending' : 'delivered';
};

const StockRow = ({sellable, stock}: Readonly<{sellable: number; stock: number}>) => (
  <View style={styles.stockRow}>
    <StatusBadge status={stockBadge(sellable)} />
    <Text style={styles.stockText}>{stockLabel(sellable, stock)}</Text>
  </View>
);

/**
 * One row of chips per option (Color, Talla…), exposed as radio groups to
 * screen readers. Values without stock stay pressable so the shopper can still
 * switch the other option, but are dimmed and announced as out of stock.
 */
const OptionPicker = ({
  options,
  variants,
  selection,
  onChange,
}: Readonly<{
  options: ProductOption[];
  variants: Variant[];
  selection: Selection;
  onChange: (next: Selection) => void;
}>) => (
  <View style={styles.options}>
    {options.map(option => (
      <View key={option.name} accessibilityRole="radiogroup" accessibilityLabel={option.name}>
        <Text style={styles.optionLabel}>
          {option.name}: <Text style={styles.optionValue}>{selection[option.name] ?? 'choose one'}</Text>
        </Text>
        <View style={styles.optionChips}>
          {option.values.map(value => {
            const {exists, inStock} = valueState(variants, options, selection, option.name, value);
            const checked = selection[option.name] === value;
            const soldOut = !exists || !inStock;
            let note = '';
            if (!exists) {
              note = ', not available';
            } else if (!inStock) {
              note = ', out of stock';
            }
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{checked}}
                accessibilityLabel={`${value}${note}`}
                onPress={() => onChange({...selection, [option.name]: value})}
                hitSlop={4}
                style={[
                  styles.optionChip,
                  checked && styles.optionChipActive,
                  soldOut && styles.optionChipSoldOut,
                ]}>
                <Text
                  style={[
                    styles.optionChipText,
                    checked && styles.optionChipTextActive,
                    soldOut && styles.optionChipTextSoldOut,
                  ]}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ))}
  </View>
);

const ProductDetailScreen = ({route}: Props) => {
  const {id} = route.params;
  const dispatch = useAppDispatch();
  const rootNav = useNavigation();
  const cartItems = useAppSelector(s => s.cart.items);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selection, setSelection] = useState<Selection>({});

  const run = useCallback(async () => {
    const {data} = await productsApi.detail(id);
    return data.product;
  }, [id]);

  const {data: product, loading, refreshing, error, refresh} = useAsync(run, [id]);

  // Open on the first combination that can be bought.
  const productKey = product?.id;
  useEffect(() => {
    if (product) {
      setSelection(initialSelection(product.variants ?? []));
      setQuantity(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKey]);

  if (loading) {
    return <Loading />;
  }
  if (error || !product) {
    return <ErrorState message={error ?? 'Product not found'} onRetry={refresh} />;
  }

  const images = product.images ?? [];
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  const hasOptions = options.length > 0;
  // The variant being bought: the chosen combination, or the only one.
  const variant = hasOptions ? findVariant(variants, options, selection) : variants[0] ?? null;
  const missing = options.filter(o => !selection[o.name]).map(o => o.name.toLowerCase());

  const basePrice = variant?.price ?? Number.parseFloat(product.price);
  const price = applyDiscount(product, basePrice);
  const discounted = price < basePrice;
  const range = effectivePriceRange(product);
  // Until a full combination is chosen, show the range rather than one price.
  const showRange = hasOptions && !variant && range.min !== range.max;

  // Stock minus other carts' holds, for the chosen variant.
  let sellable = 0;
  if (variant) {
    sellable = variant.available_stock ?? variant.stock;
  } else if (!hasOptions) {
    sellable = sellableStock(product);
  }
  const key = lineKey({product_id: product.id, variant_id: variant?.id ?? null});
  const inCart = cartItems.find(i => lineKey(i) === key)?.quantity ?? 0;
  const remaining = sellable - inCart;
  const canAdd = (!hasOptions || variant !== null) && remaining > 0;

  const choose = (next: Selection) => {
    setSelection(next);
    setQuantity(1);
  };

  let ctaTitle = 'Add to cart';
  if (hasOptions && !variant) {
    ctaTitle = missing.length ? `Choose ${missing.join(' and ')}` : 'Not available';
  } else if (!canAdd) {
    ctaTitle = 'Unavailable';
  }

  const add = () => {
    dispatch(addItem({product, variant, quantity: Math.min(quantity, remaining)}));
    // @ts-expect-error — jumping across tab navigators is untyped here
    rootNav.navigate('CartTab', {screen: 'Cart'});
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.gallery}>
        <Gallery images={images} active={activeImage} onSelect={setActiveImage} />
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
          <Text style={styles.price}>
            {showRange
              ? `${formatMoney(range.min)} – ${formatMoney(range.max)}`
              : formatMoney(price)}
          </Text>
          {discounted && !showRange ? (
            <>
              <Text style={styles.strike}>{formatMoney(basePrice)}</Text>
              <View style={styles.saveTag}>
                <Text style={styles.saveText}>
                  Save {Math.round(Number.parseFloat(product.discount_percent))}%
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {hasOptions ? (
          <OptionPicker
            options={options}
            variants={variants}
            selection={selection}
            onChange={choose}
          />
        ) : null}

        {!hasOptions || variant ? (
          <StockRow sellable={sellable} stock={variant?.stock ?? product.stock} />
        ) : null}

        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        ) : null}

        {variant?.sku ?? product.sku ? (
          <Text style={styles.sku}>SKU {variant?.sku ?? product.sku}</Text>
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
          title={ctaTitle}
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
  options: {gap: spacing.lg},
  optionLabel: {fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm},
  optionValue: {fontWeight: '400', color: colors.textMuted},
  optionChips: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  optionChip: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: {borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft},
  optionChipSoldOut: {borderStyle: 'dashed', backgroundColor: colors.surfaceAlt},
  optionChipText: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  optionChipTextActive: {color: colors.primary},
  optionChipTextSoldOut: {color: colors.textFaint, textDecorationLine: 'line-through'},
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
