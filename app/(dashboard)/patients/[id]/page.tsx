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
import { PatientHeader } from "./patient-header";
import { PatientDetailsTab } from "./patient-details-tab";
import { PatientCharts } from "./patient-charts";
import { PatientHistory } from "./patient-history";
import { PatientPhotos } from "./patient-photos";
import { PatientForms } from "./patient-forms";
import { PatientDocuments } from "./patient-documents";
import { PatientInvoices } from "./patient-invoices";
import { PatientTabs } from "./patient-tabs";

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

  // Compute lastAppointmentDate from completed/checked-in appointments
  const completedAppointments = timeline.appointments.filter(
    (a) => a.status === "Completed" || a.status === "CheckedIn"
  );
  const lastAppointmentDate = completedAppointments.length > 0
    ? new Date(Math.max(...completedAppointments.map((a) => new Date(a.startTime).getTime())))
    : null;

  const canEdit =
    user.role !== "MedicalDirector" &&
    user.role !== "ReadOnly" &&
    user.role !== "Billing";

  const tabs = [
    {
      value: "details",
      label: "Details",
      icon: <User className="size-4" />,
      content: (
        <PatientDetailsTab
          patient={patient}
          timeline={timeline}
          canEdit={canEdit}
        />
      ),
    },
    {
      value: "history",
      label: "History",
      icon: <Clock className="size-4" />,
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <PatientHistory timeline={timeline} />
        </div>
      ),
    },
    ...(canViewCharts
      ? [
          {
            value: "charts",
            label: "Charts",
            icon: <FileText className="size-4" />,
            content: (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <PatientCharts charts={charts} />
              </div>
            ),
          },
        ]
      : []),
    {
      value: "photos",
      label: "Photos",
      icon: <Camera className="size-4" />,
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <PatientPhotos photos={timeline.photos} />
        </div>
      ),
    },
    {
      value: "forms",
      label: "Forms",
      icon: <ClipboardList className="size-4" />,
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <PatientForms consents={timeline.consents} />
        </div>
      ),
    },
    {
      value: "documents",
      label: "Docs",
      icon: <FolderOpen className="size-4" />,
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <PatientDocuments documents={timeline.documents} />
        </div>
      ),
    },
    {
      value: "invoices",
      label: "Invoices",
      icon: <Receipt className="size-4" />,
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <PatientInvoices invoices={timeline.invoices} />
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 py-6 space-y-4">
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
        lastAppointmentDate={lastAppointmentDate}
      />

      <PatientTabs tabs={tabs} />
    </div>
  );
}
