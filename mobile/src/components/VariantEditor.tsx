import React from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {Button, Field, Icon} from './ui';
import {colors, font, radius, spacing} from '../theme';
import {
  cleanOptions,
  isStale,
  regenerate,
  type OptionDraft,
  type VariantDraft,
} from '../utils/variants';

const MAX_OPTIONS = 3;

/**
 * Admin editor for a product's options (Color: Rojo, Azul) and the variant
 * rows generated from them, each with its own SKU, price and stock.
 */
export const VariantEditor = ({
  productName,
  basePrice,
  options,
  variants,
  onOptionsChange,
  onVariantsChange,
}: Readonly<{
  productName: string;
  basePrice: string;
  options: OptionDraft[];
  variants: VariantDraft[];
  onOptionsChange: (next: OptionDraft[]) => void;
  onVariantsChange: (next: VariantDraft[]) => void;
}>) => {
  const parsed = cleanOptions(options);
  const stale = variants.some(v => isStale(options, v));
  const setOption = (i: number, patch: Partial<OptionDraft>) =>
    onOptionsChange(options.map((o, j) => (j === i ? {...o, ...patch} : o)));
  const setVariant = (i: number, patch: Partial<VariantDraft>) =>
    onVariantsChange(variants.map((v, j) => (j === i ? {...v, ...patch} : v)));
  const totalStock = variants.reduce((n, v) => n + (Number.parseInt(v.stock, 10) || 0), 0);

  return (
    <View style={styles.wrap}>
      {options.map((o, i) => (
        <View key={i} style={styles.optionBlock}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Option {i + 1}</Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove option ${o.name || i + 1}`}
              onPress={() => onOptionsChange(options.filter((_, j) => j !== i))}>
              <Icon name="trash-can-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
          <Field
            label="Name"
            value={o.name}
            onChangeText={name => setOption(i, {name})}
            placeholder="Color"
          />
          <Field
            label="Values (comma separated)"
            value={o.valuesText}
            onChangeText={valuesText => setOption(i, {valuesText})}
            placeholder="Rojo, Azul, Verde"
          />
        </View>
      ))}

      <View style={styles.actions}>
        {options.length < MAX_OPTIONS ? (
          <Button
            title="Add option"
            variant="secondary"
            icon="plus"
            onPress={() => onOptionsChange([...options, {name: '', valuesText: ''}])}
          />
        ) : null}
        {parsed.length > 0 ? (
          <Button
            title={variants.length ? 'Update variants' : 'Generate variants'}
            variant="secondary"
            icon="auto-fix"
            onPress={() => onVariantsChange(regenerate(productName, options, variants))}
          />
        ) : null}
      </View>

      {stale ? (
        <Text style={styles.warning}>
          The options changed. Tap “Update variants” to match them — stock is kept for
          combinations that remain.
        </Text>
      ) : null}

      {variants.map((v, i) => {
        const label =
          parsed.map(o => v.options[o.name]).filter(Boolean).join(' / ') ||
          Object.values(v.options).join(' / ');
        return (
          <View key={v.id ?? label} style={[styles.variant, isStale(options, v) && styles.variantStale]}>
            <View style={styles.variantHeader}>
              <Text style={styles.variantTitle}>{label}</Text>
              <View style={styles.variantActions}>
                <Text style={styles.activeLabel}>For sale</Text>
                <Switch
                  value={v.is_active}
                  onValueChange={is_active => setVariant(i, {is_active})}
                  trackColor={{true: colors.primary, false: colors.border}}
                  accessibilityLabel={`${label} is for sale`}
                />
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove variant ${label}`}
                  onPress={() => onVariantsChange(variants.filter((_, j) => j !== i))}>
                  <Icon name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
            <Field
              label="SKU"
              value={v.sku}
              onChangeText={sku => setVariant(i, {sku})}
              autoCapitalize="characters"
            />
            <View style={styles.split}>
              <Field
                label="Price"
                value={v.price}
                onChangeText={price => setVariant(i, {price})}
                placeholder={basePrice || 'Product price'}
                keyboardType="decimal-pad"
                style={styles.splitItem}
              />
              <Field
                label="Stock"
                value={v.stock}
                onChangeText={stock => setVariant(i, {stock})}
                keyboardType="number-pad"
                style={styles.splitItem}
              />
            </View>
          </View>
        );
      })}

      {variants.length > 0 ? (
        <Text style={styles.hint}>
          {variants.length} variants · {totalStock} units · leave price empty to use the product
          price
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {gap: spacing.md},
  optionBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionTitle: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  warning: {
    fontSize: font.xs,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    lineHeight: 17,
  },
  variant: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  variantStale: {borderColor: colors.warning},
  variantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  variantTitle: {fontSize: font.md, fontWeight: '700', color: colors.text, flexShrink: 1},
  variantActions: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  activeLabel: {fontSize: font.xs, color: colors.textMuted},
  split: {flexDirection: 'row', gap: spacing.md},
  splitItem: {flex: 1},
  hint: {fontSize: font.xs, color: colors.textMuted},
});
