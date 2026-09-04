import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {productsApi} from '../../api';
import {errorMessage} from '../../api/client';
import {useAsync} from '../../hooks/useAsync';
import {Button, EmptyState, ErrorState, Field, Icon, Loading} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {formatMoney} from '../../utils/format';
import {useAppSelector} from '../../store/hooks';
import type {AdminStackParams} from '../../navigation/types';
import {mediaUrl} from '../../utils/media';

type Props = NativeStackScreenProps<AdminStackParams, 'AdminProducts'>;

const AdminProductsScreen = ({navigation}: Props) => {
  const isAdmin = useAppSelector(s => s.auth.user?.role === 'admin');
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(rawSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  const run = useCallback(async () => {
    const {data} = await productsApi.adminList({
      limit: 100,
      ...(search ? {search} : {}),
    });
    return data.products;
  }, [search]);

  const {data: products, loading, refreshing, error, refresh} = useAsync(run, [search]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete product', `Permanently delete "${name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await productsApi.remove(id);
            await refresh();
          } catch (err) {
            Alert.alert('Could not delete', errorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) {
    return <Loading />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={products ?? []}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <Field
            value={rawSearch}
            onChangeText={setRawSearch}
            placeholder="Search products"
            autoCapitalize="none"
          />
        }
        renderItem={({item}) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('AdminProductForm', {id: item.id})}>
            {item.primary_image ? (
              <Image source={{uri: mediaUrl(item.primary_image)}} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Icon name="image-outline" size={18} color={colors.textFaint} />
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.category_name ?? 'Uncategorised'}
                {item.sku ? ` · ${item.sku}` : ''}
              </Text>
              <View style={styles.tags}>
                <Text style={styles.price}>{formatMoney(item.price)}</Text>
                <Text
                  style={[
                    styles.stock,
                    item.stock <= 0 && styles.stockOut,
                    item.stock > 0 && item.stock <= 5 && styles.stockLow,
                  ]}>
                  {item.stock} in stock
                </Text>
                {!item.is_active ? (
                  <Text style={styles.hidden}>Hidden</Text>
                ) : null}
                {item.discount_active ? (
                  <Text style={styles.deal}>
                    -{Math.round(Number.parseFloat(item.discount_percent))}%
                  </Text>
                ) : null}
              </View>
            </View>
            {isAdmin ? (
              <Pressable
                hitSlop={8}
                onPress={() => confirmDelete(item.id, item.name)}>
                <Icon name="trash-can-outline" size={20} color={colors.danger} />
              </Pressable>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="tag-off-outline"
            title="No products"
            message={search ? 'Nothing matches that search.' : 'Add your first product.'}
          />
        }
      />
      <View style={styles.footer}>
        <Button
          title="New product"
          icon="plus"
          onPress={() => navigation.navigate('AdminProductForm', {})}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: {width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt},
  thumbFallback: {alignItems: 'center', justifyContent: 'center'},
  body: {flex: 1, gap: 2},
  name: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  meta: {fontSize: font.xs, color: colors.textMuted},
  tags: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap'},
  price: {fontSize: font.sm, fontWeight: '700', color: colors.text},
  stock: {fontSize: font.xs, color: colors.textMuted},
  stockLow: {color: colors.warning, fontWeight: '600'},
  stockOut: {color: colors.danger, fontWeight: '600'},
  hidden: {fontSize: font.xs, color: colors.textFaint, fontStyle: 'italic'},
  deal: {fontSize: font.xs, color: colors.danger, fontWeight: '700'},
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default AdminProductsScreen;
