import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../components/EventCard';
import { deleteEvent, fetchMine, fetchRoster, leaveEvent } from '../lib/api';
import { nameInitial, useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';
import type { MineEvent, RosterRow } from '../lib/types';
import { useNow } from '../lib/useNow';

/** Same cadence as the feed, so a host watches people arrive. */
const POLL_MS = 20000;

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export default function Mine() {
  const router = useRouter();
  const { userId, clearDisplayName } = useSession();
  const now = useNow();

  const [mine, setMine] = useState<MineEvent | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  // First paint only — the 20s poll refreshes underneath without a spinner.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const found = await fetchMine(userId);
      setMine(found);
      setRoster(found ? await fetchRoster(found.event.id) : []);
      setError(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  /**
   * The host's join row is written first by the database trigger, so ordering
   * by `created_at` already puts them on top. This makes it certain without
   * disturbing the arrival order of everyone else.
   */
  const people = useMemo(() => {
    const hostId = mine?.event.host_id;
    if (!hostId) return roster;
    return [...roster].sort(
      (a, b) => Number(b.user_id === hostId) - Number(a.user_id === hostId)
    );
  }, [roster, mine]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  /**
   * Cancel if it's yours, leave if it isn't. Either way the feed refetches on
   * focus as this modal closes, so the card goes with it.
   */
  async function confirmAction() {
    if (!mine || !userId || busy) return;

    setBusy(true);
    setError(null);
    try {
      if (mine.role === 'host') await deleteEvent(mine.event.id);
      else await leaveEvent(mine.event.id, userId);
      close();
    } catch (cause) {
      setError(message(cause));
      setBusy(false);
    }
  }

  async function changeName() {
    await clearDisplayName('/mine');
  }

  const hosting = mine?.role === 'host';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
        <Text style={styles.title}>Your event</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : mine ? (
        <ScrollView contentContainerStyle={styles.body}>
          <EventCard
            event={mine.event}
            now={now}
            pending={false}
            blocked={false}
            // The pill is the same decision as the button below it.
            onToggleJoin={() => setConfirming(true)}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{`Who's in (${people.length})`}</Text>

            <View style={styles.roster}>
              {people.map((person) => (
                <Person
                  key={person.user_id}
                  name={person.user_name}
                  isHost={person.user_id === mine.event.host_id}
                />
              ))}
            </View>

            {people.length === 1 ? (
              <Text style={styles.note}>Nobody else yet — share the feed.</Text>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>You&apos;re not in anything right now.</Text>
          <Pressable
            onPress={() => router.replace('/host')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.hostCta, pressed && styles.pressed]}
          >
            <Text style={styles.hostCtaLabel}>Host something</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.footer}>
        {mine ? (
          confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>
                {hosting
                  ? 'Cancel this event? Everyone will be removed.'
                  : 'Leave this event?'}
              </Text>
              <View style={styles.confirmRow}>
                <Pressable
                  onPress={() => void confirmAction()}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.confirmButton,
                    styles.danger,
                    busy && styles.disabled,
                    pressed && !busy && styles.pressed,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.dangerLabel}>
                      {hosting ? 'Yes, cancel' : 'Yes, leave'}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setConfirming(false)}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.confirmButton,
                    styles.outline,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.outlineLabel}>
                    {hosting ? 'Keep it' : 'Stay'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.action,
                hosting ? styles.dangerOutline : styles.outline,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.actionLabel, hosting && styles.actionLabelDanger]}
              >
                {hosting ? 'Cancel event' : 'Leave event'}
              </Text>
            </Pressable>
          )
        ) : null}

        <Pressable
          onPress={() => void changeName()}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.changeName, pressed && styles.pressed]}
        >
          <Text style={styles.changeNameLabel}>Change name</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Person({ name, isHost }: { name: string; isHost: boolean }) {
  return (
    <View style={styles.person}>
      <View style={styles.personAvatar}>
        <Text style={styles.personAvatarText}>{nameInitial(name)}</Text>
      </View>
      <Text style={styles.personName} numberOfLines={1}>
        {name}
      </Text>
      {isHost ? <Text style={styles.hostTag}>host</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
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
  done: {
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
  banner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  bannerText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  roster: {
    gap: spacing.md,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  personAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  personName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  hostTag: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: '600',
  },
  note: {
    color: colors.faint,
    fontSize: 13,
    lineHeight: 19,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  hostCta: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
  hostCtaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  action: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirm: {
    gap: spacing.md,
  },
  confirmText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  danger: {
    backgroundColor: colors.accent,
  },
  dangerLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dangerOutline: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  actionLabelDanger: {
    color: colors.accent,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  outlineLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  changeName: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  changeNameLabel: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: '500',
  },
});
