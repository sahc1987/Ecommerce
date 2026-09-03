import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors, font, radius, shadow, spacing, statusColor, statusLabel} from '../theme';

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const isDisabled = disabled || loading;
  const palette = {
    primary: {bg: colors.primary, fg: '#fff', border: colors.primary},
    secondary: {bg: colors.surface, fg: colors.text, border: colors.border},
    ghost: {bg: 'transparent', fg: colors.primary, border: 'transparent'},
    danger: {bg: colors.danger, fg: '#fff', border: colors.danger},
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, {color: palette.fg}]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

/* ----------------------------------------------------------------- Field */

export const Field = ({
  label,
  error,
  hint,
  rightAction,
  style,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  rightAction?: React.ReactNode;
}) => (
  <View style={[styles.field, style as StyleProp<ViewStyle>]}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <View style={[styles.inputWrap, !!error && styles.inputWrapError]}>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        {...inputProps}
      />
      {rightAction}
    </View>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>
);

/* ------------------------------------------------------------ Containers */

export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.card, style]}>{children}</View>;

export const Screen = ({
  children,
  scroll,
  style,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement;
}) =>
  scroll ? (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, style]}>{children}</View>
  );

/* --------------------------------------------------------------- Feedback */

export const Loading = ({label}: {label?: string}) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
    {label ? <Text style={styles.centerText}>{label}</Text> : null}
  </View>
);

export const EmptyState = ({
  icon = 'inbox-outline',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) => (
  <View style={styles.center}>
    <Icon name={icon} size={44} color={colors.textFaint} />
    <Text style={styles.emptyTitle}>{title}</Text>
    {message ? <Text style={styles.centerText}>{message}</Text> : null}
    {action ? <View style={styles.emptyAction}>{action}</View> : null}
  </View>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <View style={styles.center}>
    <Icon name="alert-circle-outline" size={44} color={colors.danger} />
    <Text style={styles.emptyTitle}>Something went wrong</Text>
    <Text style={styles.centerText}>{message}</Text>
    {onRetry ? (
      <View style={styles.emptyAction}>
        <Button title="Try again" onPress={onRetry} variant="secondary" />
      </View>
    ) : null}
  </View>
);

/* ----------------------------------------------------------------- Badge */

export const StatusBadge = ({status}: {status: string}) => {
  const palette = statusColor[status] ?? {
    bg: colors.surfaceAlt,
    fg: colors.textMuted,
  };
  return (
    <View style={[styles.badge, {backgroundColor: palette.bg}]}>
      <Text style={[styles.badgeText, {color: palette.fg}]}>
        {statusLabel[status] ?? status}
      </Text>
    </View>
  );
};

export const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export const Row = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
  </View>
);

export const SectionTitle = ({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) => (
  <View style={styles.sectionTitle}>
    <Text style={styles.sectionTitleText}>{title}</Text>
    {action}
  </View>
);

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  screenContent: {padding: spacing.lg, paddingBottom: spacing.xxl},
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonInner: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  buttonText: {fontSize: font.md, fontWeight: '600'},
  field: {marginBottom: spacing.lg},
  fieldLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs + 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputWrapError: {borderColor: colors.danger},
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: font.md,
    color: colors.text,
  },
  fieldError: {color: colors.danger, fontSize: font.xs, marginTop: spacing.xs},
  fieldHint: {color: colors.textFaint, fontSize: font.xs, marginTop: spacing.xs},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: {
    color: colors.textMuted,
    fontSize: font.sm,
    textAlign: 'center',
  },
  emptyTitle: {fontSize: font.lg, fontWeight: '700', color: colors.text},
  emptyAction: {marginTop: spacing.md},
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase'},
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {fontSize: font.sm, color: colors.textMuted, fontWeight: '600'},
  chipTextActive: {color: '#fff'},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    gap: spacing.lg,
  },
  rowLabel: {color: colors.textMuted, fontSize: font.sm},
  rowValue: {color: colors.text, fontSize: font.sm, flexShrink: 1, textAlign: 'right'},
  rowStrong: {color: colors.text, fontSize: font.lg, fontWeight: '700'},
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitleText: {fontSize: font.lg, fontWeight: '700', color: colors.text},
});

export {Icon};
