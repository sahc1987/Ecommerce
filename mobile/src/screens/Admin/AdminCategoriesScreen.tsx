import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchImageLibrary, type Asset} from 'react-native-image-picker';
import {categoriesApi} from '../../api';
import {errorMessage} from '../../api/client';
import {useAsync} from '../../hooks/useAsync';
import {Button, EmptyState, ErrorState, Field, Icon, Loading} from '../../components/ui';
import {colors, font, radius, spacing} from '../../theme';
import {useAppSelector} from '../../store/hooks';
import type {Category, Subcategory} from '../../types';
import {mediaUrl} from '../../utils/media';

const AdminCategoriesScreen = () => {
  const isAdmin = useAppSelector(s => s.auth.user?.role === 'admin');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [subs, setSubs] = useState<Record<number, Subcategory[]>>({});

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [subParent, setSubParent] = useState<Category | null>(null);
  const [subName, setSubName] = useState('');

  const run = useCallback(async () => {
    const {data} = await categoriesApi.list();
    return data.categories;
  }, []);

  const {data: categories, loading, refreshing, error, refresh} = useAsync(run, []);

  const toggle = async (category: Category) => {
    if (expanded === category.id) {
      setExpanded(null);
      return;
    }
    setExpanded(category.id);
    if (!subs[category.id]) {
      try {
        const {data} = await categoriesApi.subcategories(category.id);
        setSubs(prev => ({...prev, [category.id]: data.subcategories}));
      } catch {
        setSubs(prev => ({...prev, [category.id]: []}));
      }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setImage(null);
    setCreating(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? '');
    setImage(null);
    setCreating(true);
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (!result.didCancel && result.assets?.[0]) {
      setImage(result.assets[0]);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      return;
    }
    const form = new FormData();
    form.append('name', name.trim());
    form.append('description', description.trim());
    if (image?.uri) {
      form.append('image', {
        uri: image.uri,
        type: image.type ?? 'image/jpeg',
        name: image.fileName ?? `category-${Date.now()}.jpg`,
      } as unknown as Blob);
    }
    setSaving(true);
    try {
      if (editing) {
        await categoriesApi.update(editing.id, form);
      } else {
        await categoriesApi.create(form);
      }
      setCreating(false);
      await refresh();
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (category: Category) => {
    Alert.alert(
      'Delete category',
      `Delete "${category.name}"? Its subcategories go with it and products become uncategorised.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await categoriesApi.remove(category.id);
              await refresh();
            } catch (err) {
              Alert.alert('Could not delete', errorMessage(err));
            }
          },
        },
      ],
    );
  };

  const saveSubcategory = async () => {
    if (!subParent || !subName.trim()) {
      return;
    }
    setSaving(true);
    try {
      await categoriesApi.createSub(subParent.id, {name: subName.trim()});
      const {data} = await categoriesApi.subcategories(subParent.id);
      setSubs(prev => ({...prev, [subParent.id]: data.subcategories}));
      setSubParent(null);
      setSubName('');
      await refresh();
    } catch (err) {
      Alert.alert('Could not add', errorMessage(err));
    } finally {
      setSaving(false);
    }
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
        data={categories ?? []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({item}) => (
          <View style={styles.card}>
            <Pressable style={styles.cardHead} onPress={() => toggle(item)}>
              {item.image_url ? (
                <Image source={{uri: mediaUrl(item.image_url)}} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="shape-outline" size={18} color={colors.textFaint} />
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.product_count ?? 0} products · {item.subcategory_count ?? 0}{' '}
                  subcategories
                </Text>
              </View>
              <Icon
                name={expanded === item.id ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textFaint}
              />
            </Pressable>

            {expanded === item.id ? (
              <View style={styles.expanded}>
                {(subs[item.id] ?? []).map(sub => (
                  <View key={sub.id} style={styles.subRow}>
                    <Icon
                      name="subdirectory-arrow-right"
                      size={16}
                      color={colors.textFaint}
                    />
                    <Text style={styles.subName}>{sub.name}</Text>
                    {isAdmin ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          Alert.alert('Delete subcategory', `Delete "${sub.name}"?`, [
                            {text: 'Cancel', style: 'cancel'},
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await categoriesApi.removeSub(sub.id);
                                  setSubs(prev => ({
                                    ...prev,
                                    [item.id]: (prev[item.id] ?? []).filter(
                                      s => s.id !== sub.id,
                                    ),
                                  }));
                                } catch (err) {
                                  Alert.alert('Could not delete', errorMessage(err));
                                }
                              },
                            },
                          ])
                        }>
                        <Icon
                          name="trash-can-outline"
                          size={16}
                          color={colors.danger}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {(subs[item.id] ?? []).length === 0 ? (
                  <Text style={styles.noSubs}>No subcategories.</Text>
                ) : null}
                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={() => openEdit(item)}>
                    <Icon name="pencil-outline" size={16} color={colors.primary} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.action}
                    onPress={() => {
                      setSubParent(item);
                      setSubName('');
                    }}>
                    <Icon name="plus" size={16} color={colors.primary} />
                    <Text style={styles.actionText}>Subcategory</Text>
                  </Pressable>
                  {isAdmin ? (
                    <Pressable
                      style={styles.action}
                      onPress={() => confirmDelete(item)}>
                      <Icon name="trash-can-outline" size={16} color={colors.danger} />
                      <Text style={[styles.actionText, styles.dangerText]}>
                        Delete
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shape-outline"
            title="No categories"
            message="Group your products so customers can browse them."
          />
        }
      />

      <View style={styles.footer}>
        <Button title="New category" icon="plus" onPress={openCreate} />
      </View>

      <Modal visible={creating} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit category' : 'New category'}
            </Text>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Footwear"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Pressable style={styles.imagePicker} onPress={pickImage}>
              {image?.uri ? (
                <Image source={{uri: image.uri}} style={styles.pickedImage} />
              ) : editing?.image_url ? (
                <Image source={{uri: mediaUrl(editing.image_url)}} style={styles.pickedImage} />
              ) : (
                <Icon name="image-plus" size={24} color={colors.textFaint} />
              )}
              <Text style={styles.imagePickerText}>
                {image ? 'Change image' : 'Choose an image'}
              </Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCreating(false)}
                style={styles.flex}
              />
              <Button
                title="Save"
                onPress={save}
                loading={saving}
                disabled={!name.trim()}
                style={styles.flex}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={!!subParent} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              New subcategory in {subParent?.name}
            </Text>
            <Field
              label="Name"
              value={subName}
              onChangeText={setSubName}
              placeholder="e.g. Running shoes"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setSubParent(null)}
                style={styles.flex}
              />
              <Button
                title="Add"
                onPress={saveSubcategory}
                loading={saving}
                disabled={!subName.trim()}
                style={styles.flex}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
  list: {padding: spacing.lg, gap: spacing.md},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  thumb: {width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt},
  thumbFallback: {alignItems: 'center', justifyContent: 'center'},
  name: {fontSize: font.sm, fontWeight: '600', color: colors.text},
  meta: {fontSize: font.xs, color: colors.textMuted, marginTop: 2},
  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  subRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  subName: {flex: 1, fontSize: font.sm, color: colors.textMuted},
  noSubs: {fontSize: font.xs, color: colors.textFaint},
  actions: {flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm},
  action: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  actionText: {fontSize: font.sm, color: colors.primary, fontWeight: '600'},
  dangerText: {color: colors.danger},
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  imagePicker: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  pickedImage: {width: 80, height: 80, borderRadius: radius.md},
  imagePickerText: {fontSize: font.xs, color: colors.textMuted},
  modalActions: {flexDirection: 'row', gap: spacing.md},
});

export default AdminCategoriesScreen;
