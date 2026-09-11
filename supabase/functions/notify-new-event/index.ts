// @ts-nocheck


// supabase/functions/notify-new-event/index.ts
//
// Deploy:  npx supabase functions deploy notify-new-event --no-verify-jwt
// Secret:  npx supabase secrets set WEBHOOK_SECRET=<long random string>
//
// Triggered by a Database Webhook on `events` INSERT (see WEBHOOK_SETUP.md).
// --no-verify-jwt because the caller is Postgres, not a user; the shared
// secret header is the auth instead.

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo's per-request max

type EventRow = {
  id: string;
  title: string;
  place: string;
  host_id: string;
  host_name: string;
};

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  const { type, record } = (await req.json()) as { type: string; record: EventRow };
  if (type !== 'INSERT' || !record) return new Response('ignored');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: rows, error } = await supabase
    .from('push_tokens')
    .select('token')
    .neq('user_id', record.host_id);

  if (error) return new Response(error.message, { status: 500 });

  const tokens = [...new Set((rows ?? []).map((r) => r.token as string))];
  if (tokens.length === 0) return new Response('no recipients');

  const messages = tokens.map((to) => ({
    to,
    title: `${record.host_name} is running it`,
    body: `${record.title} · ${record.place}`,
    sound: 'default',
    data: { eventId: record.id },
  }));

  const dead: string[] = [];

  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const { data: tickets } = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    tickets?.forEach((t, j) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
        dead.push(chunk[j].to);
      }
    });
  }

  if (dead.length) {
    await supabase.from('push_tokens').delete().in('token', dead);
  }

  return new Response(`sent ${tokens.length}, pruned ${dead.length}`);
});