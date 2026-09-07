import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="host" options={{ presentation: 'modal' }} />
      </Stack>
    </NameGate>
  );
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
