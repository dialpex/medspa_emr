import { PageCard } from "@/components/ui/page-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureGate } from "@/components/feature-gate";

export default async function MarketingPage() {
  if (!(await isFeatureEnabled("marketing_tools"))) {
    return <FeatureGate feature="marketing_tools" />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard title="AI Marketing">
        <div className="py-12 text-center text-gray-400">
          AI Marketing features coming soon...
        </div>
      </PageCard>
    </div>
  );
}
