import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {categoriesApi, productsApi} from '../../api';
import {errorMessage} from '../../api/client';
import {ProductCard} from '../../components/ProductCard';
import {Chip, EmptyState, ErrorState, Field, Loading} from '../../components/ui';
import {colors, font, spacing} from '../../theme';
import type {Category, Product} from '../../types';
import type {ShopStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<ShopStackParams, 'Home'>;

const PAGE_SIZE = 20;

const HomeScreen = ({navigation}: Props) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<number | null>(null);
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce typing so we do not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(rawSearch.trim()), 350);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  useEffect(() => {
    categoriesApi
      .list()
      .then(({data}) => setCategories(data.categories.filter(c => c.is_active)))
      .catch(() => setCategories([]));
  }, []);

  const params = useMemo(
    () => ({
      limit: PAGE_SIZE,
      ...(category ? {category} : {}),
      ...(search ? {search} : {}),
      ...(onlyDeals ? {discount: 'true' as const} : {}),
    }),
    [category, search, onlyDeals],
  );

  const fetchPage = useCallback(
    async (nextPage: number, mode: 'replace' | 'append') => {
      try {
        const {data} = await productsApi.list({...params, page: nextPage});
        setProducts(prev =>
          mode === 'append' ? [...prev, ...data.products] : data.products,
        );
        setPage(data.page);
        setPages(data.pages);
        setError(null);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [params],
  );

  useEffect(() => {
    setLoading(true);
    void fetchPage(1, 'replace').finally(() => setLoading(false));
  }, [fetchPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchPage(1, 'replace').finally(() => setRefreshing(false));
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || page >= pages) {
      return;
    }
    setLoadingMore(true);
    void fetchPage(page + 1, 'append').finally(() => setLoadingMore(false));
  }, [fetchPage, loading, loadingMore, page, pages]);

  const header = (
    <View style={styles.header}>
      <Field
        value={rawSearch}
        onChangeText={setRawSearch}
        placeholder="Search products"
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.search}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        <Chip label="All" active={!category && !onlyDeals} onPress={() => {
          setCategory(null);
          setOnlyDeals(false);
        }} />
        <Chip label="Deals" active={onlyDeals} onPress={() => setOnlyDeals(v => !v)} />
        {categories.map(c => (
          <Chip
            key={c.id}
            label={c.name}
            active={category === c.id}
            onPress={() => setCategory(prev => (prev === c.id ? null : c.id))}
          />
        ))}
      </ScrollView>
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <Loading />
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <ErrorState message={error} onRetry={onRefresh} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={products}
      keyExtractor={item => item.id}
      numColumns={2}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={({item}) => (
        <ProductCard
          product={item}
          onPress={() =>
            navigation.navigate('ProductDetail', {id: item.id, name: item.name})
          }
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="magnify"
          title="No products found"
          message={
            search || category || onlyDeals
              ? 'Try clearing your filters.'
              : 'This store has no products yet.'
          }
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={styles.footer} color={colors.primary} />
        ) : page >= pages && products.length > 0 ? (
          <Text style={styles.end}>That is everything.</Text>
        ) : (
          <View />
        )
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  list: {padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg},
  column: {gap: spacing.lg},
  header: {marginBottom: spacing.xs},
  search: {marginBottom: spacing.md},
  chips: {paddingBottom: spacing.md, paddingRight: spacing.lg},
  footer: {paddingVertical: spacing.lg},
  end: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: font.xs,
    paddingVertical: spacing.lg,
  },
});

export default HomeScreen;
