import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type DeleteUserRequest = {
  userId: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // Support both custom and legacy secret names.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('PROJECT_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, {
        error: 'Missing function secrets. Set PROJECT_URL/PROJECT_ANON_KEY/SERVICE_ROLE_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY).',
      });
    }
    if (!authHeader) {
      return json(401, { error: 'Missing Authorization header.' });
    }

    // Authenticated caller context (enforces that only signed-in users can call).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !authData.user) {
      return json(401, { error: authErr?.message ?? 'Invalid auth session.' });
    }

    const { data: actorProfile, error: actorErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (actorErr) return json(500, { error: actorErr.message });
    if (!actorProfile || actorProfile.role !== 'superadmin') {
      return json(403, { error: 'Only superadmin can delete portal users.' });
    }

    const body = (await req.json()) as DeleteUserRequest;
    const userId = body.userId?.trim();
    if (!userId) return json(400, { error: 'userId is required.' });
    if (userId === authData.user.id) {
      return json(400, { error: 'You cannot delete your own user from the portal.' });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Delete auth user first; DB rows will cascade via FK on profiles(id) → auth.users(id).
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json(400, { error: delErr.message });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
});

