// Pure helpers with no browser or network dependencies, so they are easy to unit test.

export type ElectionStatus = "upcoming" | "active" | "ended";

export interface CandidateResult {
  id: number;
  name: string;
  votes: number;
  percentage: number;
}

export interface ResultsSummary {
  totalVotes: number;
  candidates: CandidateResult[];
  /** Candidates with the highest vote count. More than one means a tie. Empty if no votes. */
  leaders: CandidateResult[];
}

export function getElectionStatus(startTime: number, endTime: number, nowSeconds: number): ElectionStatus {
  if (nowSeconds < startTime) return "upcoming";
  if (nowSeconds >= endTime) return "ended";
  return "active";
}

export function computeResults(names: string[], voteCounts: Array<number | bigint>): ResultsSummary {
  if (names.length !== voteCounts.length) {
    throw new Error("names and voteCounts must have the same length");
  }
  const votes = voteCounts.map((v) => Number(v));
  const totalVotes = votes.reduce((sum, v) => sum + v, 0);

  const candidates: CandidateResult[] = names.map((name, id) => ({
    id,
    name,
    votes: votes[id],
    percentage: totalVotes === 0 ? 0 : Math.round((votes[id] / totalVotes) * 1000) / 10,
  }));

  const sorted = [...candidates].sort((a, b) => b.votes - a.votes || a.id - b.id);
  const top = sorted[0]?.votes ?? 0;
  const leaders = top === 0 ? [] : sorted.filter((c) => c.votes === top);

  return { totalVotes, candidates: sorted, leaders };
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

export function explorerTxUrl(explorerBase: string, txHash: string): string {
  return `${explorerBase.replace(/\/$/, "")}/tx/${txHash}`;
}

export function explorerAddressUrl(explorerBase: string, address: string): string {
  return `${explorerBase.replace(/\/$/, "")}/address/${address}`;
}

const CONTRACT_ERRORS: Record<string, string> = {
  AlreadyVoted: "This wallet has already voted in this election.",
  ElectionNotActive: "Voting is not open for this election right now.",
  ElectionNotFound: "This election does not exist on-chain.",
  InvalidCandidate: "That candidate is not on the ballot.",
  NotAdmin: "Only the contract admin can do this.",
  InvalidTimes: "The end time must be after the start time and in the future.",
  ElectionAlreadyStarted: "Candidates can't be added after voting has started.",
  EmptyName: "Names can't be empty.",
};

/** Turn an ethers/MetaMask error into something a voter can read. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: string | number; reason?: string; shortMessage?: string; message?: string; revert?: { name?: string } };
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "You rejected the transaction in your wallet.";
  const name = e?.revert?.name;
  if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name];
  const text = `${e?.reason ?? ""} ${e?.shortMessage ?? ""} ${e?.message ?? ""}`;
  for (const key of Object.keys(CONTRACT_ERRORS)) {
    if (text.includes(key)) return CONTRACT_ERRORS[key];
  }
  if (text.includes("insufficient funds")) return "Not enough test ETH to pay gas. Grab some from an Arbitrum Sepolia faucet.";
  return e?.shortMessage || e?.reason || e?.message || "Something went wrong.";
}

export interface ElectionFormInput {
  title: string;
  start: string; // datetime-local value
  end: string;
  candidates: { name: string }[];
}

export function validateElectionForm(input: ElectionFormInput, nowMs = Date.now()): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Title is required.");
  const start = Date.parse(input.start);
  const end = Date.parse(input.end);
  if (Number.isNaN(start)) errors.push("Start time is required.");
  if (Number.isNaN(end)) errors.push("End time is required.");
  if (!Number.isNaN(start) && !Number.isNaN(end)) {
    if (end <= start) errors.push("End time must be after start time.");
    if (end <= nowMs) errors.push("End time must be in the future.");
  }
  const names = input.candidates.map((c) => c.name.trim());
  if (names.filter(Boolean).length < 2) errors.push("Add at least two candidates.");
  if (names.some((n) => !n)) errors.push("Every candidate needs a name.");
  const lower = names.filter(Boolean).map((n) => n.toLowerCase());
  if (new Set(lower).size !== lower.length) errors.push("Candidate names must be unique.");
  return errors;
}

export function toUnixSeconds(dateTimeLocal: string): number {
  return Math.floor(Date.parse(dateTimeLocal) / 1000);
}
