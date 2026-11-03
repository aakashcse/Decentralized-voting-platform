export const config = {
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 421614),
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Arbitrum Sepolia",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.arbiscan.io",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export const isContractConfigured = /^0x[0-9a-fA-F]{40}$/.test(config.contractAddress);
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
