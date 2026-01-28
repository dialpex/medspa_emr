import { Suspense } from "react";
import { getPatients } from "@/lib/actions/patients";
import { requirePermission } from "@/lib/rbac";
import { PatientList } from "./patient-list";
import { PatientSearch } from "./patient-search";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patients</h1>
        {canCreate && (
          <Link
            href="/patients/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Patient
          </Link>
        )}
      </div>

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
    </div>
  );
}

async function PatientListLoader({ search }: { search?: string }) {
  const patients = await getPatients(search);
  return <PatientList patients={patients} />;
}
