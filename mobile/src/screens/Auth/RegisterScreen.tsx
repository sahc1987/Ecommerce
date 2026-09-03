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
import {clearError, register} from '../../store/slices/authSlice';
import type {AuthStackParams} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParams, 'Register'>;

const RegisterScreen = ({navigation}: Props) => {
  const dispatch = useAppDispatch();
  const {loading, error} = useAppSelector(s => s.auth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const mismatch = touched && confirm.length > 0 && confirm !== password;
  const tooShort = touched && password.length > 0 && password.length < 8;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    password === confirm;

  const submit = () => {
    setTouched(true);
    if (!canSubmit) {
      return;
    }
    void dispatch(register({name: name.trim(), email: email.trim(), password}));
  };

  const goLogin = () => {
    dispatch(clearError());
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            It only takes a moment to start ordering.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            autoComplete="name"
          />
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
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={tooShort ? 'Use at least 8 characters.' : null}
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
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={mismatch ? 'Passwords do not match.' : null}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          <Button title="Create account" onPress={submit} loading={loading} />

          <Pressable onPress={goLogin} style={styles.switch}>
            <Text style={styles.switchText}>
              Already registered? <Text style={styles.switchLink}>Sign in</Text>
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
  content: {flexGrow: 1, justifyContent: 'center', padding: spacing.xl},
  title: {fontSize: font.xxl, fontWeight: '700', color: colors.text},
  subtitle: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
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

export default RegisterScreen;
