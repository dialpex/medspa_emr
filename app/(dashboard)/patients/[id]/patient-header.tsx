"use client";

import Link from "next/link";
import { Clock, Phone, Mail, Plus, AlertCircle } from "lucide-react";
import type { PatientDetail } from "@/lib/actions/patients";
import { PatientAvatar } from "@/components/patient-avatar";

function formatAge(dateOfBirth: Date | null): string | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} years old`;
}

function formatDOB(dateOfBirth: Date | null): string | null {
  if (!dateOfBirth) return null;
  return new Date(dateOfBirth).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function getDisplayStatus(
  patient: PatientDetail,
  lastAppointmentDate: Date | null
): { label: string; colors: string } {
  if (patient.status === "Fired") {
    return { label: "Fired", colors: "bg-red-50 text-red-700 border-red-200" };
  }

  if (lastAppointmentDate) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    if (new Date(lastAppointmentDate) >= twelveMonthsAgo) {
      return { label: "Active", colors: "bg-green-50 text-green-700 border-green-200" };
    }
  }

  return { label: "Inactive", colors: "bg-gray-100 text-gray-600 border-gray-200" };
}

function PatientTags({ tags }: { tags: string | null }) {
  if (!tags) return null;
  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tagList.length === 0) return null;

  return (
    <>
      {tagList.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200"
        >
          {tag}
        </span>
      ))}
    </>
  );
}

export function PatientHeader({
  patient,
  canViewCharts,
  lastAppointmentDate,
}: {
  patient: PatientDetail;
  canViewCharts: boolean;
  lastAppointmentDate: Date | null;
}) {
  const age = formatAge(patient.dateOfBirth);
  const dob = formatDOB(patient.dateOfBirth);
  const displayStatus = getDisplayStatus(patient, lastAppointmentDate);

  return (
    <div className="rounded-lg border bg-white shadow-sm p-6">
      <div className="flex items-center justify-between gap-4">
        {/* Left: avatar + info */}
        <div className="flex items-center gap-4 min-w-0">
          <PatientAvatar
            firstName={patient.firstName}
            lastName={patient.lastName}
            size="lg"
          />
          <div className="min-w-0">
            {/* Name + tags row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.firstName} {patient.lastName}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${displayStatus.colors}`}>
                {displayStatus.label}
              </span>
              <PatientTags tags={patient.tags} />
            </div>

            {/* Info row: DOB · phone · email */}
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
              {dob && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {dob} ({age})
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" />
                  {patient.phone}
                </span>
              )}
              {patient.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" />
                  {patient.email}
                </span>
              )}
            </div>

            {patient.allergies && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-red-600">
                <AlertCircle className="size-3.5 flex-shrink-0" />
                <span className="font-medium">Allergies:</span>
                <span>{patient.allergies}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {patient.phone && (
            <a
              href={`tel:${patient.phone}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Phone className="size-4" />
              Call
            </a>
          )}
          {patient.email && (
            <a
              href={`mailto:${patient.email}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Mail className="size-4" />
              Email
            </a>
          )}
          {canViewCharts && (
            <Link
              href={`/charts/new?patientId=${patient.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="size-4" />
              Create Chart
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
