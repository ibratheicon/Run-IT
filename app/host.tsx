import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';
import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  clockTime,
  parseDurationMinutes,
  parseTimeOfDay,
} from '../lib/time';
import { useNow } from '../lib/useNow';

/** How long from now the thing starts. */
const WHEN_OPTIONS = [
  { label: 'Now', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 },
  { label: '2 hr', minutes: 120 },
];

/** How long it runs for. Start plus this is `ends_at`, which is the expiry. */
const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 },
];

const DEFAULT_OFFSET_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;

/** A chip is either one of the presets above or the hand-typed escape hatch. */
type Choice = number | 'custom';

const MIN_WANTED = 1;
const MAX_WANTED = 50;
const DEFAULT_WANTED = 4;

const MAX_TITLE = 80;
const MAX_PLACE = 60;
const MAX_DESCRIPTION = 200;

/**
 * The head count is typed as well as stepped, so the field's truth is the
 * text and the number is derived from it — that way Go live reads the same
 * value whether or not the input ever lost focus.
 */
/** `clockTime` reads ISO strings; the form does its arithmetic in epoch ms. */
function clockAt(ms: number): string {
  return clockTime(new Date(ms).toISOString());
}

function digitsOnly(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

function clampWanted(text: string): number {
  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) return MIN_WANTED;
  return Math.min(MAX_WANTED, Math.max(MIN_WANTED, parsed));
}

export default function Host() {
  const router = useRouter();
  const { userId, displayName } = useSession();
  // Keeps the "Starts 10:59 PM" hint honest while the form sits open.
  const now = useNow();

  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [whenChoice, setWhenChoice] = useState<Choice>(DEFAULT_OFFSET_MINUTES);
  const [customTime, setCustomTime] = useState('');
  const [lengthChoice, setLengthChoice] = useState<Choice>(DEFAULT_DURATION_MINUTES);
  const [customDuration, setCustomDuration] = useState('');
  const [wantedText, setWantedText] = useState(String(DEFAULT_WANTED));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State updates are async, so rapid taps can both pass a `busy` check and
  // post twice. The ref flips synchronously on the first tap.
  const submitting = useRef(false);

  const wanted = clampWanted(wantedText);

  /**
   * A custom time or length that doesn't parse yet reads as null all the way
   * through: no start, no end, no Go live.
   */
  const startMs =
    whenChoice === 'custom'
      ? parseTimeOfDay(customTime, now)
      : now + whenChoice * 60000;
  const durationMinutes =
    lengthChoice === 'custom' ? parseDurationMinutes(customDuration) : lengthChoice;
  const endMs =
    startMs !== null && durationMinutes !== null
      ? startMs + durationMinutes * 60000
      : null;

  const valid =
    title.trim().length > 0 &&
    place.trim().length > 0 &&
    startMs !== null &&
    durationMinutes !== null;

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function goLive() {
    if (!valid || submitting.current) return;
    if (!userId) {
      setError('Not signed in yet. Give it a second and try again.');
      return;
    }

    // Recomputed at submit time, not when the chips were tapped.
    const start =
      whenChoice === 'custom'
        ? parseTimeOfDay(customTime, Date.now())
        : Date.now() + whenChoice * 60000;

    if (start === null || durationMinutes === null) {
      setError('Check the time and length first.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await createEvent({
        host_id: userId,
        host_name: displayName ?? 'Someone',
        title: title.trim(),
        place: place.trim(),
        description: description.trim() || null,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(start + durationMinutes * 60000).toISOString(),
        wants: wanted,
      });
      // No history to pop after a refresh, so go to the feed directly.
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't post that.");
      // Only re-enable on failure — on success we're on our way out.
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={leave}
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
              value={title}
              onChangeText={setTitle}
              placeholder="Pickup basketball"
              placeholderTextColor={colors.faint}
              autoFocus
              maxLength={MAX_TITLE}
              returnKeyType="next"
              style={styles.input}
            />
          </Field>

          <Field label="Where">
            <TextInput
              value={place}
              onChangeText={setPlace}
              placeholder="Main lobby"
              placeholderTextColor={colors.faint}
              maxLength={MAX_PLACE}
              returnKeyType="done"
              style={styles.input}
            />
          </Field>

          <Field
            label="Details (optional)"
            subHint={`${description.length}/${MAX_DESCRIPTION}`}
          >
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Anything else people should know."
              placeholderTextColor={colors.faint}
              multiline
              maxLength={MAX_DESCRIPTION}
              style={[styles.input, styles.multiline]}
            />
          </Field>

          <Field
            label="When"
            hint={
              startMs === null
                ? 'Enter a time like 9:45 PM'
                : `Starts ${clockAt(startMs)}`
            }
            subHint={endMs === null ? undefined : `Ends ${clockAt(endMs)}`}
          >
            <View style={styles.chipWrap}>
              {WHEN_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={whenChoice === option.minutes}
                  onPress={() => setWhenChoice(option.minutes)}
                />
              ))}
              <Chip
                label="Custom"
                selected={whenChoice === 'custom'}
                onPress={() => setWhenChoice('custom')}
              />
            </View>

            {whenChoice === 'custom' ? (
              <TextInput
                value={customTime}
                onChangeText={setCustomTime}
                placeholder="e.g. 9:45 PM"
                placeholderTextColor={colors.faint}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                accessibilityLabel="Start time"
                style={styles.input}
              />
            ) : null}
          </Field>

          <Field
            label="How long"
            hint={
              durationMinutes === null
                ? `Enter ${MIN_DURATION_MINUTES}–${MAX_DURATION_MINUTES} minutes`
                : undefined
            }
          >
            <View style={styles.chipWrap}>
              {DURATION_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={lengthChoice === option.minutes}
                  onPress={() => setLengthChoice(option.minutes)}
                />
              ))}
              <Chip
                label="Custom"
                selected={lengthChoice === 'custom'}
                onPress={() => setLengthChoice('custom')}
              />
            </View>

            {lengthChoice === 'custom' ? (
              <TextInput
                value={customDuration}
                onChangeText={(next) => setCustomDuration(digitsOnly(next))}
                placeholder={`Minutes (${MIN_DURATION_MINUTES}–${MAX_DURATION_MINUTES})`}
                placeholderTextColor={colors.faint}
                autoFocus
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                accessibilityLabel="Length in minutes"
                style={styles.input}
              />
            ) : null}
          </Field>

          <Field label="How many people do you want?">
            <View style={styles.stepper}>
              <StepperButton
                label="−"
                disabled={wanted <= MIN_WANTED}
                onPress={() => setWantedText(String(Math.max(MIN_WANTED, wanted - 1)))}
              />
              <TextInput
                value={wantedText}
                onChangeText={(next) => setWantedText(digitsOnly(next))}
                onBlur={() => setWantedText(String(wanted))}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={2}
                selectTextOnFocus
                accessibilityLabel="How many people you want"
                style={styles.stepperValue}
              />
              <StepperButton
                label="+"
                disabled={wanted >= MAX_WANTED}
                onPress={() => setWantedText(String(Math.min(MAX_WANTED, wanted + 1)))}
              />
            </View>
            <Text style={styles.hint}>
              Shown as a target, not a cap — nobody gets turned away.
            </Text>
          </Field>
        </ScrollView>

        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
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
          <Text style={styles.footerNote}>Disappears when it ends.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  subHint,
  children,
}: {
  label: string;
  hint?: string;
  /** The quieter half of the hint line: the end time, a character count. */
  subHint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.hintRow}>
          {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
          {subHint ? <Text style={styles.fieldSubHint}>{subHint}</Text> : null}
        </View>
      </View>
      {children}
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  fieldHint: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldSubHint: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
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
  multiline: {
    minHeight: 88,
    paddingTop: spacing.lg,
    textAlignVertical: 'top',
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
    minWidth: 64,
    paddingVertical: spacing.xs,
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
  error: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  footerNote: {
    color: colors.faint,
    fontSize: 12,
    textAlign: 'center',
  },
});
