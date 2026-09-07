import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  useSession,
  type SessionValue,
} from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

/**
 * The entire onboarding: a first name. No email, no password, no verification
 * step that can rate-limit us on move-in day. The name never leaves the
 * device except as a copy on the events this person hosts.
 */
export function NameGate({ children }: { children: ReactNode }) {
  const { displayName, setDisplayName } = useSession();

  if (displayName) return <>{children}</>;

  return <NamePrompt setDisplayName={setDisplayName} />;
}

function NamePrompt({
  setDisplayName,
}: {
  setDisplayName: SessionValue['setDisplayName'];
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= NAME_MIN_LENGTH;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setDisplayName(name);
    } catch {
      setError("Couldn't save that name. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <View style={styles.brandBlock}>
            <Text style={styles.wordmark}>RunIt</Text>
            <Text style={styles.tagline}>
              What&apos;s happening in your dorm in the next couple of hours.
            </Text>
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.label}>What should people call you?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name"
              placeholderTextColor={colors.faint}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submit}
              maxLength={NAME_MAX_LENGTH}
              style={styles.input}
            />
            <Text style={styles.hint}>
              That&apos;s it — no email, no password. This shows up next to
              anything you host or join.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <Pressable
            onPress={submit}
            disabled={!valid || busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              (!valid || busy) && styles.ctaDisabled,
              pressed && valid && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaLabel}>Start</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  brandBlock: {
    gap: spacing.md,
  },
  wordmark: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  tagline: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 24,
  },
  formBlock: {
    gap: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.text,
    fontSize: 18,
  },
  hint: {
    color: colors.faint,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg + 2,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.35,
  },
  ctaPressed: {
    opacity: 0.8,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
