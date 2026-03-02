import { notFound } from "next/navigation";
import Link from "next/link";
import {
  User,
  Clock,
  FileText,
  Camera,
  ClipboardList,
  FolderOpen,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { getPatient, getPatientTimeline } from "@/lib/actions/patients";
import { getCharts } from "@/lib/actions/charts";
import { requirePermission, hasPermission } from "@/lib/rbac";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientHeader } from "./patient-header";
import { PatientDetails } from "./patient-details";
import { PatientCharts } from "./patient-charts";
import { PatientHistory } from "./patient-history";
import { PatientPhotos } from "./patient-photos";
import { PatientForms } from "./patient-forms";
import { PatientDocuments } from "./patient-documents";
import { PatientInvoices } from "./patient-invoices";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("patients", "view");

  const canViewCharts = hasPermission(user.role, "charts", "view");

  const [patient, timeline, charts] = await Promise.all([
    getPatient(id),
    getPatientTimeline(id),
    canViewCharts ? getCharts({ patientId: id }) : Promise.resolve([]),
  ]);

  if (!patient) {
    notFound();
  }

  const canEdit =
    user.role !== "MedicalDirector" &&
    user.role !== "ReadOnly" &&
    user.role !== "Billing";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <nav className="flex items-center gap-1 text-sm text-gray-500">
        <Link href="/patients" className="hover:text-gray-900 transition-colors">
          Patients
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-gray-900 font-medium">
          {patient.firstName} {patient.lastName}
        </span>
      </nav>

      <PatientHeader
        patient={patient}
        canViewCharts={canViewCharts}
      />

      <Tabs defaultValue="details">
        <TabsList className="w-full h-auto p-1 gap-1">
          <TabsTrigger value="details" className="flex-1 py-2 px-3 text-xs">
            <User className="size-3.5 mr-1" />
            Details
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 py-2 px-3 text-xs">
            <Clock className="size-3.5 mr-1" />
            History
          </TabsTrigger>
          {canViewCharts && (
            <TabsTrigger value="charts" className="flex-1 py-2 px-3 text-xs">
              <FileText className="size-3.5 mr-1" />
              Charts
            </TabsTrigger>
          )}
          <TabsTrigger value="photos" className="flex-1 py-2 px-3 text-xs">
            <Camera className="size-3.5 mr-1" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="forms" className="flex-1 py-2 px-3 text-xs">
            <ClipboardList className="size-3.5 mr-1" />
            Forms
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 py-2 px-3 text-xs">
            <FolderOpen className="size-3.5 mr-1" />
            Docs
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex-1 py-2 px-3 text-xs">
            <Receipt className="size-3.5 mr-1" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <PatientDetails patient={patient} canEdit={canEdit} />
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <PatientHistory timeline={timeline} />
          </div>
        </TabsContent>

        {canViewCharts && (
          <TabsContent value="charts" className="mt-4">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <PatientCharts charts={charts} />
            </div>
          </TabsContent>
        )}

        <TabsContent value="photos" className="mt-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <PatientPhotos photos={timeline.photos} />
          </div>
        </TabsContent>

        <TabsContent value="forms" className="mt-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <PatientForms consents={timeline.consents} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <PatientDocuments documents={timeline.documents} />
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <PatientInvoices invoices={timeline.invoices} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
