import { Suspense } from "react";
import Link from "next/link";
import { getPatients } from "@/lib/actions/patients";
import { requirePermission } from "@/lib/rbac";
import { PatientList } from "./patient-list";
import { PatientSearch } from "./patient-search";
import { Spinner } from "@/components/ui/spinner";
import { PageCard } from "@/components/ui/page-card";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePermission("patients", "view");
  const { q } = await searchParams;
  const canCreate = user.role !== "MedicalDirector" && user.role !== "ReadOnly" && user.role !== "Billing";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard
        title="Patient Directory"
        headerAction={
          canCreate && (
            <Link
              href="/patients/new"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              Add Patient
            </Link>
          )
        }
      >
        <PatientSearch initialSearch={q} />

        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          }
        >
          <PatientListLoader search={q} />
        </Suspense>
      </PageCard>
    </div>
  );
}

async function PatientListLoader({ search }: { search?: string }) {
  const patients = await getPatients(search);
  return <PatientList patients={patients} />;
}
