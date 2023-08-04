import {
  SupabaseClient,
  SupabaseClientOptions,
  createClient,
} from "@supabase/supabase-js";

let _client: SupabaseClient | undefined = undefined;

function createSupabaseClient(
  instanceId: string,
  key: string,
  opts?: SupabaseClientOptions<"public">
) {
  const url = `https://${instanceId}.supabase.co`;
  return createClient(url, key, opts) as SupabaseClient;
}

export function getSupabaseClient() {
  if (_client) return _client;

  const instanceId = process.env.NEXT_PUBLIC_SUPABASE_INSTANCE_ID;
  const key = process.env.NEXT_PUBLIC_SUPABASE_API_KEY;

  if (!instanceId || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_INSTANCE_ID or API_KEY");
  }
  _client = createSupabaseClient(instanceId, key);

  return _client;
}
