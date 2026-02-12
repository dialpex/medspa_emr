"use client";

import Link from "next/link";
import type { PatientListItem } from "@/lib/actions/patients";
import { PatientAvatar } from "@/components/patient-avatar";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  return phone;
}

function PatientTags({ tags }: { tags: string | null }) {
  if (!tags) return null;
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (tagList.length === 0) return null;

  return (
    <div className="flex gap-1 flex-wrap">
      {tagList.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function PatientList({ patients }: { patients: PatientListItem[] }) {
  if (patients.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No patients found. Add your first patient to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">DOB</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Tags</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Last Visit</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr
              key={patient.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <PatientAvatar firstName={patient.firstName} lastName={patient.lastName} />
                  <Link
                    href={`/patients/${patient.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {patient.lastName}, {patient.firstName}
                  </Link>
                </div>
              </td>
              <td className="py-3 px-4 text-gray-600">
                {formatDate(patient.dateOfBirth)}
              </td>
              <td className="py-3 px-4 text-gray-600">
                {formatPhone(patient.phone)}
              </td>
              <td className="py-3 px-4 text-gray-600">
                {patient.email || "—"}
              </td>
              <td className="py-3 px-4">
                <PatientTags tags={patient.tags} />
              </td>
              <td className="py-3 px-4 text-gray-600">
                {formatDate(patient.lastAppointment)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
