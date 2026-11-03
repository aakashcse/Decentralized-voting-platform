"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { JsonRpcSigner } from "ethers";
import { connectWallet, hasInjectedWallet } from "@/lib/contract";
import { friendlyError } from "@/lib/election";
import { linkWallet } from "@/lib/supabase";

interface WalletState {
  address: string | null;
  signer: JsonRpcSigner | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<JsonRpcSigner | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const { signer, address } = await connectWallet();
      setSigner(signer);
      setAddress(address);
      void linkWallet(address);
      return signer;
    } catch (err) {
      setError(friendlyError(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSigner(null);
    setAddress(null);
  }, []);

  // Reset when the user switches account or network in MetaMask.
  useEffect(() => {
    if (!hasInjectedWallet()) return;
    const eth = window.ethereum!;
    const onChange = () => {
      setSigner(null);
      setAddress(null);
    };
    eth.on?.("accountsChanged", onChange);
    eth.on?.("chainChanged", onChange);
    return () => {
      eth.removeListener?.("accountsChanged", onChange);
      eth.removeListener?.("chainChanged", onChange);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ address, signer, connecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
