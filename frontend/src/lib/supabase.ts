import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "./config";

// Off-chain data only. Votes and counts are never stored here; they always come from the contract.

export interface ElectionMeta {
  id: number; // same as the on-chain election id
  title: string;
  description: string | null;
  banner_url: string | null;
  tx_hash: string | null;
}

export interface CandidateProfile {
  id: string;
  election_id: number;
  chain_index: number; // candidate index in the contract
  name: string;
  party: string | null;
  bio: string | null;
  photo_url: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  wallet_address: string | null;
  is_admin: boolean;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return client;
}

export async function getElectionMetas(ids: number[]): Promise<Record<number, ElectionMeta>> {
  const sb = getSupabase();
  if (!sb || ids.length === 0) return {};
  const { data, error } = await sb.from("elections").select("*").in("id", ids);
  if (error) {
    console.warn("Supabase elections:", error.message);
    return {};
  }
  return Object.fromEntries((data as ElectionMeta[]).map((m) => [m.id, m]));
}

export async function getCandidateProfiles(electionId: number): Promise<Record<number, CandidateProfile>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.from("candidates").select("*").eq("election_id", electionId);
  if (error) {
    console.warn("Supabase candidates:", error.message);
    return {};
  }
  return Object.fromEntries((data as CandidateProfile[]).map((c) => [c.chain_index, c]));
}

export async function saveElectionMeta(
  meta: ElectionMeta,
  candidates: Omit<CandidateProfile, "id">[]
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("elections").upsert(meta);
  if (error) throw new Error(`Saved on-chain, but Supabase metadata failed: ${error.message}`);
  if (candidates.length) {
    const { error: cErr } = await sb.from("candidates").upsert(candidates, { onConflict: "election_id,chain_index" });
    if (cErr) throw new Error(`Saved on-chain, but candidate profiles failed: ${cErr.message}`);
  }
}

export async function getMyProfile(): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function linkWallet(address: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  const { error } = await sb
    .from("profiles")
    .update({ wallet_address: address.toLowerCase() })
    .eq("id", auth.user.id);
  if (error) console.warn("Could not link wallet:", error.message);
}
