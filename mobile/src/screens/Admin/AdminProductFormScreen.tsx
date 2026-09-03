import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {categoriesApi, productsApi} from '../../api';
import {errorMessage} from '../../api/client';
import {
  Button,
  Card,
  Chip,
  Field,
  Icon,
  Loading,
  SectionTitle,
} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import type {Category, Product, ProductImage, Subcategory} from '../../types';
import type {AdminStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParams, 'AdminProductForm'>;

interface FormState {
  name: string;
  description: string;
  price: string;
  compare_at_price: string;
  discount_percent: string;
  discount_active: boolean;
  stock: string;
  sku: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  price: '',
  compare_at_price: '',
  discount_percent: '',
  discount_active: false,
  stock: '0',
  sku: '',
  is_active: true,
};

const AdminProductFormScreen = ({route, navigation}: Props) => {
  const productId = route.params?.id;
  const isEdit = !!productId;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm(prev => ({...prev, [key]: value}));

  const applyProduct = useCallback((product: Product) => {
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      compare_at_price: product.compare_at_price ?? '',
      discount_percent: product.discount_percent ?? '0',
      discount_active: product.discount_active,
      stock: String(product.stock),
      sku: product.sku ?? '',
      is_active: product.is_active,
    });
    setCategoryId(product.category_id);
    setSubcategoryId(product.subcategory_id);
    setImages(product.images ?? []);
  }, []);

  useEffect(() => {
    categoriesApi
      .list()
      .then(({data}) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!productId) {
      return;
    }
    setLoading(true);
    productsApi
      .detail(productId)
      .then(({data}) => applyProduct(data.product))
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [productId, applyProduct]);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      return;
    }
    categoriesApi
      .subcategories(categoryId)
      .then(({data}) => setSubcategories(data.subcategories))
      .catch(() => setSubcategories([]));
  }, [categoryId]);

  const invalid =
    form.name.trim().length === 0 ||
    form.price.trim().length === 0 ||
    Number.isNaN(Number.parseFloat(form.price));

  const payload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || null,
    price: Number.parseFloat(form.price),
    compare_at_price: form.compare_at_price
      ? Number.parseFloat(form.compare_at_price)
      : null,
    discount_percent: form.discount_percent
      ? Number.parseFloat(form.discount_percent)
      : 0,
    discount_active: form.discount_active,
    stock: Number.parseInt(form.stock, 10) || 0,
    sku: form.sku.trim() || null,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    is_active: form.is_active,
  });

  const save = async () => {
    setTouched(true);
    if (invalid) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await productsApi.update(productId, payload());
      } else {
        const {data} = await productsApi.create(payload());
        // Land on the edit screen so images can be attached to the new product.
        navigation.replace('AdminProductForm', {id: data.product.id});
        return;
      }
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the product'));
    } finally {
      setSaving(false);
    }
  };

  const pickImages = async () => {
    if (!productId) {
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 10,
      quality: 0.8,
    });
    if (result.didCancel || !result.assets?.length) {
      return;
    }
    const form_ = new FormData();
    for (const asset of result.assets) {
      form_.append('images', {
        uri: asset.uri,
        type: asset.type ?? 'image/jpeg',
        name: asset.fileName ?? `upload-${Date.now()}.jpg`,
      } as unknown as Blob);
    }
    setUploading(true);
    try {
      await productsApi.uploadImages(productId, form_);
      const {data} = await productsApi.detail(productId);
      setImages(data.product.images ?? []);
    } catch (err) {
      Alert.alert('Upload failed', errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (imageId: string) => {
    if (!productId) {
      return;
    }
    Alert.alert('Remove image', 'Delete this image from the product?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await productsApi.deleteImage(productId, imageId);
            setImages(prev => prev.filter(i => i.id !== imageId));
          } catch (err) {
            Alert.alert('Could not delete', errorMessage(err));
          }
        },
      },
    ]);
  };

  const makePrimary = async (imageId: string) => {
    if (!productId) {
      return;
    }
    try {
      await productsApi.makePrimary(productId, imageId);
      setImages(prev =>
        prev.map(i => ({...i, is_primary: i.id === imageId})),
      );
    } catch (err) {
      Alert.alert('Could not update', errorMessage(err));
    }
  };

  if (loading) {
    return <Loading />;
  }

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

        <SectionTitle title="Basics" />
        <Card>
          <Field
            label="Name"
            value={form.name}
            onChangeText={set('name')}
            placeholder="Product name"
            error={touched && !form.name.trim() ? 'Required' : null}
          />
          <Field
            label="Description"
            value={form.description}
            onChangeText={set('description')}
            placeholder="What is it?"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.split}>
            <Field
              label="Price"
              value={form.price}
              onChangeText={set('price')}
              placeholder="0.00"
              keyboardType="decimal-pad"
              error={touched && invalid ? 'Required' : null}
              style={styles.splitItem}
            />
            <Field
              label="Compare at"
              value={form.compare_at_price}
              onChangeText={set('compare_at_price')}
              placeholder="Optional"
              keyboardType="decimal-pad"
              style={styles.splitItem}
            />
          </View>
          <View style={styles.split}>
            <Field
              label="Stock"
              value={form.stock}
              onChangeText={set('stock')}
              placeholder="0"
              keyboardType="number-pad"
              style={styles.splitItem}
            />
            <Field
              label="SKU"
              value={form.sku}
              onChangeText={set('sku')}
              placeholder="Optional"
              autoCapitalize="characters"
              style={styles.splitItem}
            />
          </View>
          <View style={styles.toggle}>
            <View style={styles.flex}>
              <Text style={styles.toggleLabel}>Visible in the shop</Text>
              <Text style={styles.toggleHint}>
                Hidden products stay in the catalogue but customers cannot see them.
              </Text>
            </View>
            <Switch
              value={form.is_active}
              onValueChange={set('is_active')}
              trackColor={{true: colors.primary, false: colors.border}}
            />
          </View>
        </Card>

        <SectionTitle title="Discount" />
        <Card>
          <View style={styles.toggle}>
            <View style={styles.flex}>
              <Text style={styles.toggleLabel}>Discount active</Text>
              <Text style={styles.toggleHint}>
                Applies the percentage below to the listed price.
              </Text>
            </View>
            <Switch
              value={form.discount_active}
              onValueChange={set('discount_active')}
              trackColor={{true: colors.primary, false: colors.border}}
            />
          </View>
          {form.discount_active ? (
            <Field
              label="Discount percent"
              value={form.discount_percent}
              onChangeText={set('discount_percent')}
              placeholder="10"
              keyboardType="decimal-pad"
              hint="Set start and end dates from the web admin if you need a schedule."
              style={styles.discountField}
            />
          ) : null}
        </Card>

        <SectionTitle title="Category" />
        <Card>
          <Text style={styles.pickerLabel}>Category</Text>
          <View style={styles.chipWrap}>
            <Chip
              label="None"
              active={categoryId === null}
              onPress={() => {
                setCategoryId(null);
                setSubcategoryId(null);
              }}
            />
            {categories.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                active={categoryId === c.id}
                onPress={() => {
                  setCategoryId(c.id);
                  setSubcategoryId(null);
                }}
              />
            ))}
          </View>
          {subcategories.length > 0 ? (
            <>
              <Text style={[styles.pickerLabel, styles.pickerLabelSpaced]}>
                Subcategory
              </Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="None"
                  active={subcategoryId === null}
                  onPress={() => setSubcategoryId(null)}
                />
                {subcategories.map(s => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    active={subcategoryId === s.id}
                    onPress={() => setSubcategoryId(s.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Card>

        <SectionTitle title="Images" />
        <Card>
          {!isEdit ? (
            <Text style={styles.toggleHint}>
              Save the product first, then you can attach images.
            </Text>
          ) : (
            <>
              {images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageRow}>
                  {images.map(img => (
                    <View key={img.id} style={styles.imageCell}>
                      <Image source={{uri: img.url}} style={styles.image} />
                      {img.is_primary ? (
                        <View style={styles.primaryTag}>
                          <Text style={styles.primaryText}>Primary</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.setPrimary}
                          onPress={() => makePrimary(img.id)}>
                          <Text style={styles.setPrimaryText}>Set primary</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.removeImage}
                        hitSlop={6}
                        onPress={() => removeImage(img.id)}>
                        <Icon name="close" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.toggleHint}>No images yet.</Text>
              )}
              <Button
                title="Add images"
                variant="secondary"
                icon="image-plus"
                onPress={pickImages}
                loading={uploading}
                style={styles.addImages}
              />
            </>
          )}
        </Card>

        <Button
          title={isEdit ? 'Save changes' : 'Create product'}
          icon="content-save-outline"
          onPress={save}
          loading={saving}
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
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {color: colors.danger, fontSize: font.sm, flex: 1},
  split: {flexDirection: 'row', gap: spacing.md},
  splitItem: {flex: 1},
  toggle: {flexDirection: 'row', alignItems: 'center', gap: spacing.lg},
  toggleLabel: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  toggleHint: {fontSize: font.xs, color: colors.textMuted, marginTop: 2, lineHeight: 17},
  discountField: {marginTop: spacing.lg, marginBottom: 0},
  pickerLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  pickerLabelSpaced: {marginTop: spacing.lg},
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  imageRow: {gap: spacing.md, paddingBottom: spacing.sm},
  imageCell: {width: 110},
  image: {
    width: 110,
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  primaryTag: {
    marginTop: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  primaryText: {fontSize: font.xs, color: colors.primary, fontWeight: '700'},
  setPrimary: {marginTop: spacing.xs, alignItems: 'center', paddingVertical: 2},
  setPrimaryText: {fontSize: font.xs, color: colors.textMuted},
  removeImage: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImages: {marginTop: spacing.md},
  cta: {marginTop: spacing.xl},
});

export default AdminProductFormScreen;
