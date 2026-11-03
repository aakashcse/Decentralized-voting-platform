import type { ElectionStatus } from "@/lib/election";

const labels: Record<ElectionStatus, string> = {
  upcoming: "Upcoming",
  active: "Voting open",
  ended: "Ended",
};

export default function StatusBadge({ status }: { status: ElectionStatus }) {
  return <span className={`badge badge-${status}`}>{labels[status]}</span>;
}
