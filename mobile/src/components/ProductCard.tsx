import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, font, radius, shadow, spacing} from '../theme';
import {effectivePrice, formatMoney, isDiscounted} from '../utils/format';
import type {Product} from '../types';
import {mediaUrl} from '../utils/media';

export const ProductCard = ({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) => {
  const price = effectivePrice(product);
  const discounted = isDiscounted(product);
  const image = product.primary_image ?? product.images?.[0]?.url ?? null;
  const outOfStock = product.stock <= 0;

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{uri: mediaUrl(image)}} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.imageFallbackText}>No image</Text>
          </View>
        )}
        {discounted ? (
          <View style={styles.discountTag}>
            <Text style={styles.discountText}>
              -{Math.round(Number.parseFloat(product.discount_percent))}%
            </Text>
          </View>
        ) : null}
        {outOfStock ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatMoney(price)}</Text>
          {discounted ? (
            <Text style={styles.strike}>{formatMoney(product.price)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  pressed: {opacity: 0.85},
  imageWrap: {position: 'relative', backgroundColor: colors.surfaceAlt},
  image: {width: '100%', aspectRatio: 1},
  imageFallback: {alignItems: 'center', justifyContent: 'center'},
  imageFallbackText: {color: colors.textFaint, fontSize: font.xs},
  discountTag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  discountText: {color: '#fff', fontSize: font.xs, fontWeight: '700'},
  soldOut: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {color: '#fff', fontWeight: '700', fontSize: font.sm},
  body: {padding: spacing.md, gap: spacing.xs},
  name: {fontSize: font.sm, fontWeight: '600', color: colors.text, minHeight: 34},
  priceRow: {flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm},
  price: {fontSize: font.md, fontWeight: '700', color: colors.text},
  strike: {
    fontSize: font.xs,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
});
