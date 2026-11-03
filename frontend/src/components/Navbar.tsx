"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { shortenAddress } from "@/lib/election";

const links = [
  { href: "/", label: "Elections" },
  { href: "/admin", label: "Admin" },
  { href: "/login", label: "Account" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, connecting, connect, disconnect } = useWallet();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ▣
          </span>
          BlockBallot
        </Link>
        <nav className="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        {address ? (
          <button className="btn btn-ghost" onClick={disconnect} title="Disconnect">
            <span className="dot" /> {shortenAddress(address)}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => connect()} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
