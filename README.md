# Decentralized-voting-platform 

Decentralized-voting-platform is an online voting system where every vote is stored on a blockchain. Once a vote is cast, nobody can change or delete it, not even the admin, and anyone can check the results on-chain.

The smart contract runs on **Arbitrum Sepolia** (an Ethereum Layer-2 testnet), the web app is built with **Next.js + TypeScript**, and off-chain data such as user accounts and candidate profiles lives in **Supabase**.

## Features

- **Immutable vote recording**: each vote is a blockchain transaction. The contract has no function to edit or delete a vote.
- **Decentralized verification**: vote counts are public on-chain. The results dashboard reads them straight from the contract, and anyone can verify them on [Arbiscan](https://sepolia.arbiscan.io).
- **Duplicate-vote locking**: the contract keeps `mapping(uint256 => mapping(address => bool)) hasVoted`. A second attempt from the same wallet is rejected by `require(!hasVoted[electionId][msg.sender], AlreadyVoted())`.
- **Time-boxed elections**: voting is only accepted between the start and end time, and the ballot is locked once voting opens.
- **Live results dashboard**: auto-refreshes and listens for `VoteCast` events. Shows totals, percentages and the current leader or ties.
- **Admin panel**: create elections and add candidates. Only the deployer wallet can do this, and the contract enforces it.
- **Accounts with Supabase**: email sign-up and sign-in, and linking a wallet to your profile.
- **Gas-efficient design**: only what must be trustless (candidates, votes, counts) goes on-chain. Descriptions, photos and bios are stored in Supabase.

## Tech stack

| Technology | Role |
|---|---|
| Solidity | Smart contract that stores candidates, records votes and counts them |
| Arbitrum Sepolia | Ethereum L2 testnet: fast, cheap transactions using free test ETH |
| Hardhat | Compiling, testing and deploying the contract |
| Next.js (App Router) | Voting page, results dashboard and admin panel |
| TypeScript | Type safety across the frontend |
| Ethers.js v6 | Connects to MetaMask, sends vote transactions, reads results |
| Supabase | Postgres + Auth for accounts, election details and candidate profiles |
| Jest | Unit tests for the app logic |

## Architecture

```
┌──────────────┐   read counts (RPC)    ┌─────────────────────────────────┐
│  Next.js app │ ─────────────────────▶ │ DecentralizedVotingPlatform.sol │
│  (browser)   │   vote / create tx     │ on Arbitrum Sepolia             │
│              │ ──── via MetaMask ───▶ │ candidates, votes, counts       │
│              │                        └─────────────────────────────────┘
│              │   accounts, profiles   ┌─────────────────────────────────┐
│              │ ─────────────────────▶ │ Supabase (Postgres+Auth)        │
└──────────────┘                        │ elections, candidates,          │
                                        │ profiles (no votes)             │
                                        └─────────────────────────────────┘
```

The election id and candidate index link both sides: `elections.id` in Supabase equals the on-chain election id, and `candidates.chain_index` equals the candidate's position in the contract.

## Project structure

```
contracts/            Hardhat project
  contracts/DecentralizedVotingPlatform.sol
  scripts/deploy.ts   deploys and copies the ABI into the frontend
  test/DecentralizedVotingPlatform.test.ts
frontend/             Next.js app
  src/app/            pages: /, /elections/[id], /elections/[id]/results, /admin, /login
  src/components/     wallet context, navbar, badges
  src/lib/            contract.ts (ethers), supabase.ts, election.ts (pure logic)
  __tests__/          Jest tests
supabase/schema.sql   tables, row-level security, signup trigger
```

## Getting started

### Prerequisites

- Node.js 18+
- [MetaMask](https://metamask.io) browser extension
- Free Arbitrum Sepolia test ETH from a faucet
- A free [Supabase](https://supabase.com) project (optional; voting works without it)

### 1. Smart contract

```bash
cd contracts
npm install
npm test                      # run the contract tests
cp .env.example .env          # add PRIVATE_KEY of a test wallet (never a real one)
npm run deploy:arbitrum-sepolia
```

The deploy script prints the contract address and writes the ABI to `frontend/src/lib/abi/DecentralizedVotingPlatform.json`. The wallet that deploys becomes the admin.

Optionally verify the source on Arbiscan:

```bash
npm run verify -- <CONTRACT_ADDRESS>
```

### 2. Supabase

1. Create a project and open the **SQL Editor**.
2. Run `supabase/schema.sql`.
3. Sign up in the app, then make yourself an admin:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # fill in the contract address and Supabase keys
npm run dev                   # http://localhost:3000
npm test                      # Jest unit tests
```

### Running fully locally

```bash
cd contracts && npx hardhat node              # terminal 1
cd contracts && npm run deploy:local          # terminal 2
```

Then in `frontend/.env.local` set `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545` and `NEXT_PUBLIC_CHAIN_ID=31337`, and import one of the printed Hardhat accounts into MetaMask.

## Smart contract API

| Function | Who | Description |
|---|---|---|
| `createElection(title, candidateNames[], startTime, endTime)` | admin | Creates an election and returns its id |
| `addCandidate(electionId, name)` | admin | Adds a candidate before voting opens |
| `vote(electionId, candidateId)` | anyone | Casts one vote per wallet per election |
| `getElection(electionId)` | anyone | Title, times, total votes, candidate count |
| `getCandidates(electionId)` | anyone | Candidate names and vote counts |
| `hasVoted(electionId, address)` | anyone | Whether a wallet has voted |
| `isActive(electionId)` | anyone | Whether voting is open right now |

Events: `ElectionCreated`, `CandidateAdded`, `VoteCast`.

## Tests

- **Contracts (Hardhat, 13 tests)**: admin-only access, time windows, duplicate-vote rejection (including the admin), invalid candidates, per-election vote tracking, ballot lock after start.
- **Frontend (Jest, 27 tests)**: result calculation, ties, election status, form validation, error messages, and a check that the ABI exposes no function that could modify a vote.

## Limitations and future work

- One wallet = one vote. Someone with several wallets could vote several times, so a real election would add a voter allow-list (for example, a Merkle root of verified wallets) or identity verification.
- Votes are public on-chain. Secret ballots would need commit-reveal or zero-knowledge proofs.

## License

MIT
