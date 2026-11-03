"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAllElections, fetchChainTime, type OnChainElection } from "@/lib/contract";
import { config, isContractConfigured } from "@/lib/config";
import { explorerAddressUrl, formatDuration, friendlyError, getElectionStatus } from "@/lib/election";
import { getElectionMetas, type ElectionMeta } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";
import Notice, { ConfigMissing } from "@/components/Notice";

export default function HomePage() {
  const [elections, setElections] = useState<OnChainElection[] | null>(null);
  const [metas, setMetas] = useState<Record<number, ElectionMeta>>({});
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isContractConfigured) return;
    (async () => {
      try {
        const [list, chainNow] = await Promise.all([fetchAllElections(), fetchChainTime()]);
        setElections(list);
        setNow(chainNow);
        setMetas(await getElectionMetas(list.map((e) => e.id)));
      } catch (err) {
        setError(friendlyError(err));
      }
    })();
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Votes nobody can change.</h1>
        <p>
          Every ballot on BlockBallot is a transaction on Arbitrum. Once it&apos;s cast it can&apos;t be edited or
          deleted, not even by the admin, and anyone can audit the count on-chain.
        </p>
        {isContractConfigured && (
          <a className="link" href={explorerAddressUrl(config.explorerUrl, config.contractAddress)} target="_blank" rel="noreferrer">
            View the contract on the block explorer ↗
          </a>
        )}
      </section>

      {!isContractConfigured && <ConfigMissing />}
      {error && <Notice kind="error">{error}</Notice>}

      {isContractConfigured && !elections && !error && <p className="muted">Loading elections from the chain…</p>}
      {elections?.length === 0 && <Notice>No elections yet. An admin can create one from the Admin panel.</Notice>}

      <div className="grid">
        {elections?.map((e) => {
          const status = getElectionStatus(e.startTime, e.endTime, now);
          const meta = metas[e.id];
          return (
            <article key={e.id} className="card election-card">
              {meta?.banner_url && <img className="banner" src={meta.banner_url} alt="" />}
              <div className="card-head">
                <span className="muted small">#{e.id}</span>
                <StatusBadge status={status} />
              </div>
              <h2>{e.title}</h2>
              {meta?.description && <p className="muted">{meta.description}</p>}
              <p className="small muted">
                {e.candidateNames.length} candidates · {e.totalVotes} votes ·{" "}
                {status === "upcoming" && `opens in ${formatDuration(e.startTime - now)}`}
                {status === "active" && `closes in ${formatDuration(e.endTime - now)}`}
                {status === "ended" && `closed ${new Date(e.endTime * 1000).toLocaleDateString()}`}
              </p>
              <div className="row">
                <Link className="btn btn-primary" href={`/elections/${e.id}`}>
                  {status === "active" ? "Vote" : "View ballot"}
                </Link>
                <Link className="btn btn-ghost" href={`/elections/${e.id}/results`}>
                  Results
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
