"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { castVote, fetchChainTime, fetchElection, fetchHasVoted, type OnChainElection } from "@/lib/contract";
import { config, isContractConfigured } from "@/lib/config";
import { explorerTxUrl, formatDuration, friendlyError, getElectionStatus } from "@/lib/election";
import { getCandidateProfiles, getElectionMetas, type CandidateProfile, type ElectionMeta } from "@/lib/supabase";
import { useWallet } from "@/components/WalletProvider";
import StatusBadge from "@/components/StatusBadge";
import Notice, { ConfigMissing } from "@/components/Notice";

export default function VotePage({ params }: { params: Promise<{ id: string }> }) {
  const electionId = Number(use(params).id);
  const { address, signer, connect, connecting, error: walletError } = useWallet();

  const [election, setElection] = useState<OnChainElection | null>(null);
  const [meta, setMeta] = useState<ElectionMeta | null>(null);
  const [profiles, setProfiles] = useState<Record<number, CandidateProfile>>({});
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [selected, setSelected] = useState<number | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, t] = await Promise.all([fetchElection(electionId), fetchChainTime()]);
      setElection(e);
      setNow(t);
      const [metas, profs] = await Promise.all([getElectionMetas([electionId]), getCandidateProfiles(electionId)]);
      setMeta(metas[electionId] ?? null);
      setProfiles(profs);
    } catch (err) {
      setError(friendlyError(err));
    }
  }, [electionId]);

  useEffect(() => {
    if (isContractConfigured) void load();
  }, [load]);

  useEffect(() => {
    if (!address || !isContractConfigured) return;
    fetchHasVoted(electionId, address).then(setAlreadyVoted).catch(() => undefined);
  }, [address, electionId, txHash]);

  async function submit() {
    if (selected === null) return;
    setError(null);
    setSubmitting(true);
    try {
      const s = signer ?? (await connect());
      if (!s) return;
      const hash = await castVote(s, electionId, selected);
      setTxHash(hash);
      setAlreadyVoted(true);
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isContractConfigured) return <ConfigMissing />;
  if (!election) return error ? <Notice kind="error">{error}</Notice> : <p className="muted">Loading ballot…</p>;

  const status = getElectionStatus(election.startTime, election.endTime, now);
  const canVote = status === "active" && !alreadyVoted;

  return (
    <div className="stack">
      <Link href="/" className="link small">
        ← All elections
      </Link>
      <div className="card-head">
        <h1>{election.title}</h1>
        <StatusBadge status={status} />
      </div>
      {meta?.description && <p className="muted">{meta.description}</p>}
      <p className="small muted">
        {new Date(election.startTime * 1000).toLocaleString()} → {new Date(election.endTime * 1000).toLocaleString()}
        {status === "active" && ` · closes in ${formatDuration(election.endTime - now)}`}
        {status === "upcoming" && ` · opens in ${formatDuration(election.startTime - now)}`}
      </p>

      {status === "upcoming" && <Notice>Voting hasn&apos;t opened yet. You can review the candidates below.</Notice>}
      {status === "ended" && <Notice>This election has closed. See the final results.</Notice>}
      {alreadyVoted && !txHash && <Notice kind="success">This wallet has already voted in this election.</Notice>}
      {txHash && (
        <Notice kind="success">
          Your vote is on-chain.{" "}
          <a href={explorerTxUrl(config.explorerUrl, txHash)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </Notice>
      )}
      {(error || walletError) && <Notice kind="error">{error || walletError}</Notice>}

      <div className="candidates" role="radiogroup" aria-label="Candidates">
        {election.candidateNames.map((name, i) => {
          const p = profiles[i];
          return (
            <button
              key={i}
              role="radio"
              aria-checked={selected === i}
              className={`card candidate ${selected === i ? "selected" : ""}`}
              disabled={!canVote || submitting}
              onClick={() => setSelected(i)}
            >
              {p?.photo_url ? (
                <img className="avatar" src={p.photo_url} alt="" />
              ) : (
                <span className="avatar avatar-fallback">{name.charAt(0).toUpperCase()}</span>
              )}
              <span className="candidate-body">
                <strong>{name}</strong>
                {p?.party && <span className="small muted">{p.party}</span>}
                {p?.bio && <span className="small">{p.bio}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="row">
        {canVote &&
          (address ? (
            <button className="btn btn-primary" disabled={selected === null || submitting} onClick={submit}>
              {submitting ? "Confirm in wallet…" : "Cast vote"}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={connecting} onClick={() => connect()}>
              {connecting ? "Connecting…" : "Connect wallet to vote"}
            </button>
          ))}
        <Link className="btn btn-ghost" href={`/elections/${electionId}/results`}>
          Live results
        </Link>
      </div>
      <p className="small muted">
        One vote per wallet. The contract rejects a second attempt with <code>require(!hasVoted[electionId][msg.sender])</code>.
      </p>
    </div>
  );
}
