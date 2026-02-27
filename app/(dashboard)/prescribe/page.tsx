import { PageCard } from "@/components/ui/page-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureGate } from "@/components/feature-gate";

export default async function PrescribePage() {
  if (!(await isFeatureEnabled("e_prescribe"))) {
    return <FeatureGate feature="e_prescribe" />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard title="E-Prescribe">
        <div className="py-12 text-center text-gray-400">
          E-Prescribe features coming soon...
        </div>
      </PageCard>
    </div>
  );
}
