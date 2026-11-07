import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Decentralized-voting-platform",
  description: "Tamper-proof online voting on Arbitrum. Every vote is an on-chain transaction anyone can audit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Navbar />
          <main className="container main">{children}</main>
          <footer className="footer container">
            Votes are recorded on {config.chainName}. Results are read directly from the smart contract.
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
