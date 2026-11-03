"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { fetchChainTime, fetchElection, getReadContract, type OnChainElection } from "@/lib/contract";
import { config, isContractConfigured } from "@/lib/config";
import { computeResults, explorerAddressUrl, friendlyError, getElectionStatus } from "@/lib/election";
import StatusBadge from "@/components/StatusBadge";
import Notice, { ConfigMissing } from "@/components/Notice";

const REFRESH_MS = 10_000;

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const electionId = Number(use(params).id);
  const [election, setElection] = useState<OnChainElection | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, t] = await Promise.all([fetchElection(electionId), fetchChainTime()]);
      setElection(e);
      setNow(t);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(friendlyError(err));
    }
  }, [electionId]);

  // Poll, and also refresh immediately whenever a VoteCast event for this election appears.
  useEffect(() => {
    if (!isContractConfigured) return;
    void load();
    const timer = setInterval(load, REFRESH_MS);
    const contract = getReadContract();
    const filter = contract.filters.VoteCast(electionId);
    const onVote = () => void load();
    contract.on(filter, onVote).catch(() => undefined);
    return () => {
      clearInterval(timer);
      contract.off(filter, onVote).catch(() => undefined);
    };
  }, [electionId, load]);

  if (!isContractConfigured) return <ConfigMissing />;
  if (!election) return error ? <Notice kind="error">{error}</Notice> : <p className="muted">Reading results from the chain…</p>;

  const status = getElectionStatus(election.startTime, election.endTime, now);
  const results = computeResults(election.candidateNames, election.voteCounts);
  const leaderIds = new Set(results.leaders.map((l) => l.id));

  let headline = "No votes yet.";
  if (results.leaders.length === 1) headline = `${status === "ended" ? "Winner" : "Leading"}: ${results.leaders[0].name}`;
  if (results.leaders.length > 1) headline = `Tie between ${results.leaders.map((l) => l.name).join(" & ")}`;

  return (
    <div className="stack">
      <Link href={`/elections/${electionId}`} className="link small">
        ← Back to ballot
      </Link>
      <div className="card-head">
        <h1>{election.title}: results</h1>
        <StatusBadge status={status} />
      </div>

      <div className="stats">
        <div className="card stat">
          <span className="muted small">Total votes</span>
          <strong>{results.totalVotes}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Candidates</span>
          <strong>{results.candidates.length}</strong>
        </div>
        <div className="card stat stat-wide">
          <span className="muted small">{status === "ended" ? "Final result" : "Current standing"}</span>
          <strong>{headline}</strong>
        </div>
      </div>

      <div className="card results">
        {results.candidates.map((c) => (
          <div key={c.id} className="result-row">
            <div className="result-label">
              <span>
                {c.name} {leaderIds.has(c.id) && <span className="crown">★</span>}
              </span>
              <span className="muted small">
                {c.votes} · {c.percentage}%
              </span>
            </div>
            <div className="bar">
              <div className={`bar-fill ${leaderIds.has(c.id) ? "lead" : ""}`} style={{ width: `${c.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      <p className="small muted">
        Counts are read straight from the contract, not from our server. Refreshes every {REFRESH_MS / 1000}s
        {updatedAt && ` · last updated ${updatedAt.toLocaleTimeString()}`}. Verify independently on the{" "}
        <a className="link" href={explorerAddressUrl(config.explorerUrl, config.contractAddress)} target="_blank" rel="noreferrer">
          block explorer ↗
        </a>
      </p>
    </div>
  );
}
