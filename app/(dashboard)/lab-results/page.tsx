import { PageCard } from "@/components/ui/page-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureGate } from "@/components/feature-gate";

export default async function LabResultsPage() {
  if (!(await isFeatureEnabled("lab_results"))) {
    return <FeatureGate feature="lab_results" />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard title="Lab Results">
        <div className="py-12 text-center text-gray-400">
          Lab Results features coming soon...
        </div>
      </PageCard>
    </div>
  );
}
