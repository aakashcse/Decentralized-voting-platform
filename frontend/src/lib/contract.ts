import { BrowserProvider, Contract, JsonRpcProvider, type Eip1193Provider, type JsonRpcSigner } from "ethers";
import abiJson from "./abi/BlockBallot.json";
import { config } from "./config";

export const abi = abiJson.abi;

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export interface OnChainElection {
  id: number;
  title: string;
  startTime: number;
  endTime: number;
  totalVotes: number;
  candidateNames: string[];
  voteCounts: number[];
}

let readProvider: JsonRpcProvider | null = null;

export function getReadProvider(): JsonRpcProvider {
  if (!readProvider) readProvider = new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
  return readProvider;
}

export function getReadContract(): Contract {
  return new Contract(config.contractAddress, abi, getReadProvider());
}

export async function getWriteContract(signer: JsonRpcSigner): Promise<Contract> {
  return new Contract(config.contractAddress, abi, signer);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchElection(id: number, contract: Contract = getReadContract()): Promise<OnChainElection> {
  const [title, startTime, endTime, totalVotes] = await contract.getElection(id);
  const [names, counts] = await contract.getCandidates(id);
  return {
    id,
    title,
    startTime: Number(startTime),
    endTime: Number(endTime),
    totalVotes: Number(totalVotes),
    candidateNames: [...names],
    voteCounts: [...counts].map((c: bigint) => Number(c)),
  };
}

export async function fetchAllElections(contract: Contract = getReadContract()): Promise<OnChainElection[]> {
  const count = Number(await contract.electionCount());
  const ids = Array.from({ length: count }, (_, i) => count - i); // newest first
  return Promise.all(ids.map((id) => fetchElection(id, contract)));
}

export async function fetchHasVoted(electionId: number, address: string): Promise<boolean> {
  return getReadContract().hasVoted(electionId, address);
}

export async function fetchAdmin(): Promise<string> {
  return getReadContract().admin();
}

export async function fetchChainTime(): Promise<number> {
  const block = await getReadProvider().getBlock("latest");
  return block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/** Ask MetaMask to switch to (or add) the configured network. */
export async function ensureCorrectNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet found. Install MetaMask to vote.");
  const hexChainId = `0x${config.chainId.toString(16)}`;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: config.chainName,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.explorerUrl],
        },
      ],
    });
  }
}

export async function connectWallet(): Promise<{ signer: JsonRpcSigner; address: string }> {
  if (!window.ethereum) throw new Error("No wallet found. Install MetaMask to vote.");
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  await ensureCorrectNetwork();
  const signer = await new BrowserProvider(window.ethereum).getSigner();
  return { signer, address: await signer.getAddress() };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function castVote(signer: JsonRpcSigner, electionId: number, candidateId: number): Promise<string> {
  await ensureCorrectNetwork();
  const contract = await getWriteContract(signer);
  const tx = await contract.vote(electionId, candidateId);
  await tx.wait();
  return tx.hash;
}

export async function createElectionOnChain(
  signer: JsonRpcSigner,
  title: string,
  candidateNames: string[],
  startTime: number,
  endTime: number
): Promise<{ electionId: number; txHash: string }> {
  await ensureCorrectNetwork();
  const contract = await getWriteContract(signer);
  const tx = await contract.createElection(title, candidateNames, startTime, endTime);
  const receipt = await tx.wait();
  let electionId = 0;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "ElectionCreated") electionId = Number(parsed.args.electionId);
    } catch {
      // not our event
    }
  }
  if (!electionId) electionId = Number(await contract.electionCount());
  return { electionId, txHash: tx.hash };
}

export async function addCandidateOnChain(signer: JsonRpcSigner, electionId: number, name: string): Promise<string> {
  await ensureCorrectNetwork();
  const contract = await getWriteContract(signer);
  const tx = await contract.addCandidate(electionId, name);
  await tx.wait();
  return tx.hash;
}
