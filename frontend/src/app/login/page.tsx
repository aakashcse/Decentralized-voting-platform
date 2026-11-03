"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import { getMyProfile, getSupabase, linkWallet, type Profile } from "@/lib/supabase";
import { shortenAddress } from "@/lib/election";
import { useWallet } from "@/components/WalletProvider";
import Notice from "@/components/Notice";

export default function LoginPage() {
  const sb = getSupabase();
  const { address, connect } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (user) getMyProfile().then(setProfile);
    else setProfile(null);
  }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    const res =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setBusy(false);
    if (res.error) setMsg({ kind: "error", text: res.error.message });
    else if (mode === "signup" && !res.data.session) setMsg({ kind: "success", text: "Check your email to confirm your account." });
  }

  async function link() {
    let addr = address;
    if (!addr) {
      const s = await connect();
      addr = s ? await s.getAddress() : null;
    }
    if (!addr) return;
    await linkWallet(addr);
    setProfile(await getMyProfile());
    setMsg({ kind: "success", text: "Wallet linked to your account." });
  }

  if (!isSupabaseConfigured) {
    return (
      <Notice>
        Accounts need Supabase. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code>frontend/.env.local</code>. Voting itself only needs a wallet.
      </Notice>
    );
  }

  if (user) {
    return (
      <div className="card form narrow">
        <h1>Your account</h1>
        <p>
          Signed in as <strong>{user.email}</strong>
          {profile?.is_admin && <span className="badge badge-active">admin</span>}
        </p>
        <p className="muted">
          Linked wallet: {profile?.wallet_address ? <code>{shortenAddress(profile.wallet_address, 6)}</code> : "none"}
        </p>
        <button className="btn btn-primary" onClick={link}>
          {address ? `Link ${shortenAddress(address)}` : "Connect & link wallet"}
        </button>
        <button className="btn btn-ghost" onClick={() => sb!.auth.signOut()}>
          Sign out
        </button>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </div>
    );
  }

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
      {mode === "signup" && (
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </form>
  );
}
