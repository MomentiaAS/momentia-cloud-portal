import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type UserRole = 'superadmin' | 'admin' | 'technician' | 'viewer';

type CreateUserRequest = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  initialCustomerId?: string | null;
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
    const supabaseUrl = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('PROJECT_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
      return json(403, { error: 'Only superadmin can create portal users.' });
    }

    const body = (await req.json()) as CreateUserRequest;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    const role = body.role;
    const initialCustomerId = body.initialCustomerId ?? null;

    if (!name || !email || !password || !role) {
      return json(400, { error: 'name, email, password and role are required.' });
    }
    if (!['superadmin', 'admin', 'technician', 'viewer'].includes(role)) {
      return json(400, { error: 'Invalid role.' });
    }
    if (password.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters.' });
    }
    if ((role === 'technician' || role === 'viewer') && !initialCustomerId) {
      return json(400, { error: 'initialCustomerId is required for technician/viewer.' });
    }

    // Admin context (service role): create active user + upsert profile + assignment.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created.user) {
      return json(400, { error: createErr?.message ?? 'Failed to create user.' });
    }

    const userId = created.user.id;

    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        { id: userId, email, name, role },
        { onConflict: 'id' },
      );
    if (upsertErr) {
      return json(500, { error: `User created but profile upsert failed: ${upsertErr.message}` });
    }

    if (initialCustomerId && (role === 'technician' || role === 'viewer')) {
      const { error: assignErr } = await admin
        .from('user_customers')
        .insert({ user_id: userId, customer_id: initialCustomerId });
      if (assignErr) {
        return json(500, { error: `User created but initial assignment failed: ${assignErr.message}` });
      }
    }

    return json(200, {
      id: userId,
      email,
      name,
      role,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
});
