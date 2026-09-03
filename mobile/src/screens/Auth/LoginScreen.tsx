import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Field, Icon} from '../../components/ui';
import {colors, font, spacing} from '../../theme';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {clearError, login} from '../../store/slices/authSlice';
import type {AuthStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParams, 'Login'>;

const LoginScreen = ({navigation}: Props) => {
  const dispatch = useAppDispatch();
  const {loading, error} = useAppSelector(s => s.auth);
  const storeName = useAppSelector(s => s.settings.store?.name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    void dispatch(login({email: email.trim(), password}));
  };

  const goRegister = () => {
    dispatch(clearError());
    navigation.navigate('Register');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logo}>
              <Icon name="storefront" size={30} color={colors.primary} />
            </View>
            <Text style={styles.title}>{storeName ?? 'Welcome back'}</Text>
            <Text style={styles.subtitle}>Sign in to continue shopping</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            onSubmitEditing={submit}
            returnKeyType="go"
            rightAction={
              <Pressable
                onPress={() => setShowPassword(v => !v)}
                hitSlop={8}
                style={styles.eye}>
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            }
          />

          <Button
            title="Sign in"
            onPress={submit}
            loading={loading}
            disabled={!canSubmit}
          />

          <Pressable onPress={goRegister} style={styles.switch}>
            <Text style={styles.switchText}>
              New here? <Text style={styles.switchLink}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {alignItems: 'center', marginBottom: spacing.xl},
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {fontSize: font.xxl, fontWeight: '700', color: colors.text},
  subtitle: {fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs},
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {color: colors.danger, fontSize: font.sm, flex: 1},
  eye: {paddingLeft: spacing.sm},
  switch: {marginTop: spacing.xl, alignItems: 'center'},
  switchText: {color: colors.textMuted, fontSize: font.sm},
  switchLink: {color: colors.primary, fontWeight: '700'},
});

export default LoginScreen;
