import { notFound } from "next/navigation";
import { getPatient, getPatientTimeline } from "@/lib/actions/patients";
import { requirePermission } from "@/lib/rbac";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientHeader } from "./patient-header";
import { PatientDetails } from "./patient-details";
import { PatientTimeline } from "./patient-timeline";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("patients", "view");

  const [patient, timeline] = await Promise.all([
    getPatient(id),
    getPatientTimeline(id),
  ]);

  if (!patient) {
    notFound();
  }

  const canEdit =
    user.role !== "MedicalDirector" &&
    user.role !== "ReadOnly" &&
    user.role !== "Billing";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PatientHeader patient={patient} />

      <Tabs defaultValue="details" className="mt-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <PatientDetails patient={patient} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <PatientTimeline timeline={timeline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
