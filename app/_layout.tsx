import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NameGate } from '../components/NameGate';
import { SessionProvider, useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/** No session and no name means no feed — everything downstream assumes both. */
function Gate() {
  const { userId, loading, error } = useSession();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !userId) {
    return (
      <View style={styles.splash}>
        <Text style={styles.errorTitle}>Can&apos;t sign in right now</Text>
        <Text style={styles.errorBody}>{error ?? 'No session. Reload the app.'}</Text>
      </View>
    );
  }

  return (
    <NameGate>
      <RenameReturn />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="host" options={{ presentation: 'modal' }} />
        <Stack.Screen name="mine" options={{ presentation: 'modal' }} />
      </Stack>
    </NameGate>
  );
}

/**
 * A rename drops the name, which takes the gate — and with it the whole
 * navigator — off screen. This puts the user back where they started once
 * they're named again. Renders nothing.
 */
function RenameReturn() {
  const router = useRouter();
  const { renameReturnTo, consumeRenameReturnTo } = useSession();

  useEffect(() => {
    if (!renameReturnTo) return;
    consumeRenameReturnTo();
    router.replace(renameReturnTo);
  }, [renameReturnTo, consumeRenameReturnTo, router]);

  return null;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
