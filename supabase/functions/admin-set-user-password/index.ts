import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('PROJECT_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, { error: 'Missing required function secrets.' });
    }
    if (!authHeader) {
      return json(401, { error: 'Missing Authorization header.' });
    }

    // Validate caller via end-user JWT + anon key.
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
      return json(403, { error: 'Only superadmin can set user passwords.' });
    }

    const body = (await req.json()) as { userId?: string; newPassword?: string };
    const userId = body.userId?.trim();
    const newPassword = body.newPassword?.trim() ?? '';
    if (!userId || !newPassword) {
      return json(400, { error: 'userId and newPassword are required.' });
    }
    if (newPassword.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters.' });
    }

    // Service-role update of auth.users password.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updErr) return json(400, { error: updErr.message });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
});

