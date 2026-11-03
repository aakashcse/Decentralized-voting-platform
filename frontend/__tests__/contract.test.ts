import type { Contract } from "ethers";
import { abi, fetchAllElections, fetchElection } from "@/lib/contract";

// A stand-in for the ethers Contract so the read helpers can be tested without a chain.
function mockContract(): Contract {
  const elections: Record<number, { title: string; start: bigint; end: bigint; names: string[]; counts: bigint[] }> = {
    1: { title: "First", start: 100n, end: 200n, names: ["A", "B"], counts: [3n, 1n] },
    2: { title: "Second", start: 300n, end: 400n, names: ["X", "Y", "Z"], counts: [0n, 0n, 0n] },
  };
  return {
    electionCount: jest.fn(async () => 2n),
    getElection: jest.fn(async (id: number) => {
      const e = elections[id];
      return [e.title, e.start, e.end, e.counts.reduce((a, b) => a + b, 0n), BigInt(e.names.length)];
    }),
    getCandidates: jest.fn(async (id: number) => [elections[id].names, elections[id].counts]),
  } as unknown as Contract;
}

describe("contract ABI", () => {
  const names = abi.filter((x: { type: string }) => x.type === "function").map((x: { name?: string }) => x.name);

  it("exposes the functions the frontend calls", () => {
    for (const fn of ["vote", "createElection", "addCandidate", "getElection", "getCandidates", "hasVoted", "admin", "electionCount"]) {
      expect(names).toContain(fn);
    }
  });

  it("has no function that could modify or delete a vote", () => {
    const writes = abi
      .filter((x: { type: string; stateMutability?: string }) => x.type === "function" && x.stateMutability === "nonpayable")
      .map((x: { name?: string }) => x.name)
      .sort();
    expect(writes).toEqual(["addCandidate", "createElection", "vote"]);
  });
});

describe("fetchElection", () => {
  it("converts bigint values into numbers", async () => {
    const e = await fetchElection(1, mockContract());
    expect(e).toEqual({
      id: 1,
      title: "First",
      startTime: 100,
      endTime: 200,
      totalVotes: 4,
      candidateNames: ["A", "B"],
      voteCounts: [3, 1],
    });
  });
});

describe("fetchAllElections", () => {
  it("returns every election, newest first", async () => {
    const list = await fetchAllElections(mockContract());
    expect(list.map((e) => e.id)).toEqual([2, 1]);
    expect(list[0].candidateNames).toHaveLength(3);
  });
});
