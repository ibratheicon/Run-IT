import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { createEvent } from '../lib/api';
import { colors, radius, spacing } from '../lib/theme';
import { clockTime, minutesFromNow } from '../lib/time';

/** Shortcuts for the things people actually post at 8pm on a Tuesday. */
const ACTIVITY_IDEAS = [
  'Boba run',
  'Dinner',
  'Pickup basketball',
  'Study session',
  'Walk to the Dish',
  'Movie in the lounge',
];

const PLACE_IDEAS = [
  'Otero lobby',
  'Otero lounge',
  'Wilbur dining',
  'Tresidder',
  'The Oval',
];

const WHEN_OPTIONS = [
  { label: 'Now', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 },
];

const MIN_WANTED = 1;
const MAX_WANTED = 20;

export default function Host() {
  const router = useRouter();

  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(30);
  const [wanted, setWanted] = useState(4);
  const [busy, setBusy] = useState(false);

  const valid = activity.trim().length >= 3 && location.trim().length >= 2;

  async function goLive() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await createEvent({
        activity,
        location,
        startsAt: minutesFromNow(offsetMinutes),
        capacityWanted: wanted,
      });
      router.back();
    } catch {
      Alert.alert("Couldn't post that", 'Try again in a second.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={12}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Host something</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="What">
            <TextInput
              value={activity}
              onChangeText={setActivity}
              placeholder="Boba run to Sharetea"
              placeholderTextColor={colors.faint}
              autoFocus
              maxLength={60}
              returnKeyType="next"
              style={styles.input}
            />
            <ChipRow
              options={ACTIVITY_IDEAS}
              selected={activity}
              onSelect={setActivity}
            />
          </Field>

          <Field label="Where">
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Otero lobby"
              placeholderTextColor={colors.faint}
              maxLength={60}
              returnKeyType="done"
              style={styles.input}
            />
            <ChipRow
              options={PLACE_IDEAS}
              selected={location}
              onSelect={setLocation}
            />
          </Field>

          <Field label="When" hint={`Starts ${clockTime(minutesFromNow(offsetMinutes))}`}>
            <View style={styles.chipWrap}>
              {WHEN_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={offsetMinutes === option.minutes}
                  onPress={() => setOffsetMinutes(option.minutes)}
                />
              ))}
            </View>
          </Field>

          <Field label="How many people do you want?">
            <View style={styles.stepper}>
              <StepperButton
                label="−"
                disabled={wanted <= MIN_WANTED}
                onPress={() => setWanted((n) => Math.max(MIN_WANTED, n - 1))}
              />
              <Text style={styles.stepperValue}>{wanted}</Text>
              <StepperButton
                label="+"
                disabled={wanted >= MAX_WANTED}
                onPress={() => setWanted((n) => Math.min(MAX_WANTED, n + 1))}
              />
            </View>
            <Text style={styles.hint}>
              Shown as a target, not a cap — nobody gets turned away.
            </Text>
          </Field>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={goLive}
            disabled={!valid || busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              (!valid || busy) && styles.ctaDisabled,
              pressed && valid && styles.ctaPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaLabel}>Go live</Text>
            )}
          </Pressable>
          <Text style={styles.footerNote}>
            Disappears on its own 30 minutes after it starts.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={selected.trim().toLowerCase() === option.toLowerCase()}
          onPress={() => onSelect(option)}
        />
      ))}
    </View>
  );
}

function StepperButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'One more person' : 'One fewer person'}
      style={({ pressed }) => [
        styles.stepperButton,
        disabled && styles.stepperButtonDisabled,
        pressed && !disabled && styles.stepperButtonPressed,
      ]}
    >
      <Text style={styles.stepperButtonLabel}>{label}</Text>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '500',
    width: 64,
  },
  headerSpacer: {
    width: 64,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  form: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  field: {
    gap: spacing.md,
  },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldHint: {
    color: colors.accent,
    fontSize: 14,
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
    fontSize: 17,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    color: colors.faint,
    fontSize: 13,
    lineHeight: 19,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: {
    backgroundColor: colors.cardPressed,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonLabel: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  stepperValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
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
  footerNote: {
    color: colors.faint,
    fontSize: 12,
    textAlign: 'center',
  },
});
