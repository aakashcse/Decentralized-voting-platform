import type { ReactNode } from "react";

export default function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
  return <div className={`notice notice-${kind}`}>{children}</div>;
}

export function ConfigMissing() {
  return (
    <Notice kind="error">
      Contract address not configured. Deploy the contract, then set <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> in{" "}
      <code>frontend/.env.local</code>.
    </Notice>
  );
}
