import { PageCard } from "@/components/ui/page-card";

export default function InboxPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard label="Communication" title="Inbox">
        <div className="py-12 text-center text-gray-400">
          Patient communication coming soon...
        </div>
      </PageCard>
    </div>
  );
}
