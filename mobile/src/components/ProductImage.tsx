import React, {useState} from 'react';
import {Image, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors, font, radius, spacing} from '../theme';
import {mediaUrl} from '../utils/media';

type Size = 'thumb' | 'card' | 'large';

// Same matching as the web's utils/categoryIcon.ts, with Material icon names.
const ICONS: [RegExp, string][] = [
  [/laptop|notebook|computer|pc/i, 'laptop'],
  [/phone|mobile/i, 'cellphone'],
  [/headphone|earbud|audio|earphone/i, 'headphones'],
  [/watch|wearable/i, 'watch-variant'],
  [/tablet|ipad/i, 'tablet'],
  [/gam(e|ing)|console/i, 'gamepad-variant-outline'],
  [/camera|photo/i, 'camera-outline'],
  [/accessor|cable|charger/i, 'power-plug-outline'],
  [/smart home|home/i, 'home-outline'],
  [/tv|television|monitor|display/i, 'television'],
  [/speaker/i, 'speaker'],
  [/keyboard/i, 'keyboard-outline'],
  [/mouse/i, 'mouse'],
  [/printer/i, 'printer-outline'],
];
const iconFor = (category?: string | null) =>
  ICONS.find(([re]) => re.test(category ?? ''))?.[1] ?? 'tag-outline';

const PADDING: Record<Size, number> = {thumb: 4, card: spacing.md, large: spacing.xl};
const ICON_SIZE: Record<Size, number> = {thumb: 18, card: 32, large: 56};

/**
 * Every product photo in the same neutral frame (white, thin border, whole
 * product visible), matching the web app's ProductImage. Without a photo, or if
 * it fails to load, a calm placeholder shows the category icon.
 * `style` sets the size, e.g. {width: 56, height: 56} or {width: '100%', aspectRatio: 1}.
 */
export const ProductImage = ({
  src,
  alt,
  category,
  size = 'card',
  style,
}: Readonly<{
  src?: string | null;
  alt: string;
  category?: string | null;
  size?: Size;
  style?: StyleProp<ViewStyle>;
}>) => {
  const uri = src ? mediaUrl(src) : undefined;
  // Remember which URI failed, so a new one gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const showPhoto = uri && failedUri !== uri;

  return (
    <View style={[styles.frame, size === 'thumb' ? styles.radiusSm : styles.radiusLg, style]}>
      {showPhoto ? (
        <Image
          source={{uri}}
          style={[styles.fill, {margin: PADDING[size]}]}
          resizeMode="contain"
          accessibilityLabel={alt}
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <View
          style={styles.placeholder}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${alt}, no photo yet`}>
          <Icon name={iconFor(category)} size={ICON_SIZE[size]} color={colors.textFaint} />
          {size !== 'thumb' ? <Text style={styles.caption}>Photo coming soon</Text> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  radiusSm: {borderRadius: radius.sm},
  radiusLg: {borderRadius: radius.lg},
  fill: {flex: 1, alignSelf: 'stretch'},
  placeholder: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  caption: {fontSize: font.xs, color: colors.textFaint},
});
