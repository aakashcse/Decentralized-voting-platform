import {
  computeResults,
  explorerTxUrl,
  formatDuration,
  friendlyError,
  getElectionStatus,
  shortenAddress,
  toUnixSeconds,
  validateElectionForm,
} from "@/lib/election";

describe("getElectionStatus", () => {
  it("is upcoming before start", () => expect(getElectionStatus(100, 200, 50)).toBe("upcoming"));
  it("is active from start up to (not including) end", () => {
    expect(getElectionStatus(100, 200, 100)).toBe("active");
    expect(getElectionStatus(100, 200, 199)).toBe("active");
  });
  it("is ended at end time, matching the contract", () => expect(getElectionStatus(100, 200, 200)).toBe("ended"));
});

describe("computeResults", () => {
  it("computes totals, percentages and sorts by votes", () => {
    const r = computeResults(["Asha", "Bikram", "Chandra"], [1n, 0n, 3n]);
    expect(r.totalVotes).toBe(4);
    expect(r.candidates.map((c) => c.name)).toEqual(["Chandra", "Asha", "Bikram"]);
    expect(r.candidates[0].percentage).toBe(75);
    expect(r.leaders.map((l) => l.name)).toEqual(["Chandra"]);
  });

  it("keeps the original candidate id after sorting", () => {
    const r = computeResults(["A", "B"], [0, 5]);
    expect(r.candidates[0]).toMatchObject({ id: 1, name: "B" });
  });

  it("reports ties", () => {
    const r = computeResults(["A", "B", "C"], [2, 2, 1]);
    expect(r.leaders.map((l) => l.name)).toEqual(["A", "B"]);
  });

  it("has no leader and 0% when nobody has voted", () => {
    const r = computeResults(["A", "B"], [0, 0]);
    expect(r.leaders).toEqual([]);
    expect(r.candidates.every((c) => c.percentage === 0)).toBe(true);
  });

  it("rounds percentages to one decimal", () => {
    const r = computeResults(["A", "B", "C"], [1, 1, 1]);
    expect(r.candidates[0].percentage).toBe(33.3);
  });

  it("throws on mismatched arrays", () => {
    expect(() => computeResults(["A"], [1, 2])).toThrow();
  });
});

describe("formatting helpers", () => {
  it("shortens addresses", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
    expect(shortenAddress("")).toBe("");
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(59)).toBe("0m");
    expect(formatDuration(3600 * 26 + 60 * 5)).toBe("1d 2h 5m");
    expect(formatDuration(7200)).toBe("2h");
  });

  it("builds explorer links without double slashes", () => {
    expect(explorerTxUrl("https://sepolia.arbiscan.io/", "0xabc")).toBe("https://sepolia.arbiscan.io/tx/0xabc");
  });

  it("converts datetime-local to unix seconds", () => {
    expect(toUnixSeconds("2026-01-01T00:00:00Z")).toBe(1767225600);
  });
});

describe("friendlyError", () => {
  it("handles wallet rejection", () => {
    expect(friendlyError({ code: "ACTION_REJECTED" })).toMatch(/rejected/);
    expect(friendlyError({ code: 4001 })).toMatch(/rejected/);
  });

  it("maps decoded custom errors", () => {
    expect(friendlyError({ revert: { name: "AlreadyVoted" } })).toMatch(/already voted/);
  });

  it("maps custom errors found in the message", () => {
    expect(friendlyError(new Error('execution reverted: custom error "ElectionNotActive()"'))).toMatch(/not open/);
  });

  it("explains missing gas funds", () => {
    expect(friendlyError(new Error("insufficient funds for gas"))).toMatch(/faucet/);
  });

  it("falls back to the raw message", () => {
    expect(friendlyError(new Error("boom"))).toBe("boom");
  });
});

describe("validateElectionForm", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  const valid = {
    title: "Council",
    start: "2026-11-02T10:00:00Z",
    end: "2026-11-03T10:00:00Z",
    candidates: [{ name: "A" }, { name: "B" }],
  };

  it("accepts a valid form", () => expect(validateElectionForm(valid, now)).toEqual([]));

  it("requires a title", () => {
    expect(validateElectionForm({ ...valid, title: "  " }, now)).toContain("Title is required.");
  });

  it("rejects end before start", () => {
    expect(validateElectionForm({ ...valid, end: "2026-11-02T09:00:00Z" }, now)).toContain("End time must be after start time.");
  });

  it("rejects an end time in the past", () => {
    expect(validateElectionForm({ ...valid, start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z" }, now)).toContain(
      "End time must be in the future."
    );
  });

  it("needs two named, unique candidates", () => {
    expect(validateElectionForm({ ...valid, candidates: [{ name: "A" }] }, now)).toContain("Add at least two candidates.");
    expect(validateElectionForm({ ...valid, candidates: [{ name: "A" }, { name: "" }, { name: "B" }] }, now)).toContain(
      "Every candidate needs a name."
    );
    expect(validateElectionForm({ ...valid, candidates: [{ name: "A" }, { name: "a" }] }, now)).toContain(
      "Candidate names must be unique."
    );
  });
});
