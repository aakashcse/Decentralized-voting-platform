"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createElectionOnChain, addCandidateOnChain, fetchAdmin, fetchElection } from "@/lib/contract";
import { config, isContractConfigured, isSupabaseConfigured } from "@/lib/config";
import { explorerTxUrl, friendlyError, shortenAddress, toUnixSeconds, validateElectionForm } from "@/lib/election";
import { saveElectionMeta } from "@/lib/supabase";
import { useWallet } from "@/components/WalletProvider";
import Notice, { ConfigMissing } from "@/components/Notice";

interface CandidateInput {
  name: string;
  party: string;
  bio: string;
  photo_url: string;
}

const emptyCandidate = (): CandidateInput => ({ name: "", party: "", bio: "", photo_url: "" });

export default function AdminPage() {
  const { address, signer, connect, connecting } = useWallet();
  const [admin, setAdmin] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [candidates, setCandidates] = useState<CandidateInput[]>([emptyCandidate(), emptyCandidate()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: number; tx: string } | null>(null);

  const [addId, setAddId] = useState("");
  const [addName, setAddName] = useState("");
  const [addMsg, setAddMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (isContractConfigured) fetchAdmin().then(setAdmin).catch(() => setAdmin(null));
  }, []);

  const isAdmin = Boolean(address && admin && address.toLowerCase() === admin.toLowerCase());

  function updateCandidate(i: number, field: keyof CandidateInput, value: string) {
    setCandidates((list) => list.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    const v = validateElectionForm({ title, start, end, candidates });
    setErrors(v);
    if (v.length || !signer) return;

    setBusy(true);
    try {
      const names = candidates.map((c) => c.name.trim());
      const { electionId, txHash } = await createElectionOnChain(signer, title.trim(), names, toUnixSeconds(start), toUnixSeconds(end));
      setResult({ id: electionId, tx: txHash });
      await saveElectionMeta(
        { id: electionId, title: title.trim(), description: description.trim() || null, banner_url: bannerUrl.trim() || null, tx_hash: txHash },
        candidates.map((c, i) => ({
          election_id: electionId,
          chain_index: i,
          name: c.name.trim(),
          party: c.party.trim() || null,
          bio: c.bio.trim() || null,
          photo_url: c.photo_url.trim() || null,
        }))
      );
      setTitle("");
      setDescription("");
      setBannerUrl("");
      setCandidates([emptyCandidate(), emptyCandidate()]);
    } catch (err) {
      setErrors([friendlyError(err)]);
    } finally {
      setBusy(false);
    }
  }

  async function onAddCandidate(e: FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    if (!signer || !addId || !addName.trim()) return;
    setBusy(true);
    try {
      const id = Number(addId);
      const tx = await addCandidateOnChain(signer, id, addName.trim());
      const election = await fetchElection(id);
      await saveElectionMeta(
        { id, title: election.title, description: null, banner_url: null, tx_hash: null },
        [{ election_id: id, chain_index: election.candidateNames.length - 1, name: addName.trim(), party: null, bio: null, photo_url: null }]
      ).catch(() => undefined);
      setAddMsg({ kind: "success", text: `Candidate added. Tx ${shortenAddress(tx, 6)}` });
      setAddName("");
    } catch (err) {
      setAddMsg({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!isContractConfigured) return <ConfigMissing />;

  return (
    <div className="stack">
      <h1>Admin panel</h1>
      <p className="muted">
        The admin can create elections and add candidates before voting opens. The contract has no function to edit or
        remove votes, so the admin can&apos;t change results.
      </p>

      {!address && (
        <Notice>
          Connect the admin wallet to continue.{" "}
          <button className="btn btn-primary btn-sm" onClick={() => connect()} disabled={connecting}>
            Connect wallet
          </button>
        </Notice>
      )}
      {address && admin && !isAdmin && (
        <Notice kind="error">
          {shortenAddress(address)} is not the contract admin ({shortenAddress(admin)}). Transactions from this wallet
          will be rejected on-chain.
        </Notice>
      )}
      {!isSupabaseConfigured && (
        <Notice>Supabase isn&apos;t configured, so descriptions and candidate profiles won&apos;t be saved. On-chain data still works.</Notice>
      )}

      <form className="card form" onSubmit={onCreate}>
        <h2>Create election</h2>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Student Council 2026" />
        </label>
        <label>
          Description <span className="muted small">(stored in Supabase)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
        <label>
          Banner image URL <span className="muted small">(optional)</span>
          <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://…" />
        </label>
        <div className="row">
          <label className="grow">
            Starts
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="grow">
            Ends
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <h3>Candidates</h3>
        {candidates.map((c, i) => (
          <fieldset key={i} className="candidate-input">
            <legend>Candidate {i + 1}</legend>
            <div className="row">
              <input className="grow" placeholder="Name (on-chain)" value={c.name} onChange={(e) => updateCandidate(i, "name", e.target.value)} />
              <input className="grow" placeholder="Party / tagline" value={c.party} onChange={(e) => updateCandidate(i, "party", e.target.value)} />
            </div>
            <input placeholder="Photo URL" value={c.photo_url} onChange={(e) => updateCandidate(i, "photo_url", e.target.value)} />
            <textarea placeholder="Short bio" rows={2} value={c.bio} onChange={(e) => updateCandidate(i, "bio", e.target.value)} />
            {candidates.length > 2 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCandidates((l) => l.filter((_, idx) => idx !== i))}>
                Remove
              </button>
            )}
          </fieldset>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => setCandidates((l) => [...l, emptyCandidate()])}>
          + Add candidate
        </button>

        {errors.length > 0 && (
          <Notice kind="error">
            <ul>
              {errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          </Notice>
        )}
        {result && (
          <Notice kind="success">
            Election #{result.id} created.{" "}
            <a href={explorerTxUrl(config.explorerUrl, result.tx)} target="_blank" rel="noreferrer">
              Transaction ↗
            </a>{" "}
            · <Link href={`/elections/${result.id}`}>Open ballot</Link>
          </Notice>
        )}
        <button className="btn btn-primary" type="submit" disabled={!isAdmin || busy}>
          {busy ? "Waiting for confirmation…" : "Create election on-chain"}
        </button>
      </form>

      <form className="card form" onSubmit={onAddCandidate}>
        <h2>Add candidate to an upcoming election</h2>
        <div className="row">
          <input className="grow" type="number" min={1} placeholder="Election ID" value={addId} onChange={(e) => setAddId(e.target.value)} />
          <input className="grow" placeholder="Candidate name" value={addName} onChange={(e) => setAddName(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={!isAdmin || busy}>
            Add
          </button>
        </div>
        {addMsg && <Notice kind={addMsg.kind}>{addMsg.text}</Notice>}
      </form>
    </div>
  );
}
