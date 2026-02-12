"use client";

import Link from "next/link";
import type { PatientDetail } from "@/lib/actions/patients";
import { PatientAvatar } from "@/components/patient-avatar";

function PatientTags({ tags }: { tags: string | null }) {
  if (!tags) return null;
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (tagList.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {tagList.map((tag) => (
        <span
          key={tag}
          className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function formatAge(dateOfBirth: Date | null): string {
  if (!dateOfBirth) return "";
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} years old`;
}

export function PatientHeader({ patient }: { patient: PatientDetail }) {
  return (
    <div>
      <Link
        href="/patients"
        className="text-blue-600 hover:underline text-sm mb-2 inline-block"
      >
        ← Back to Patients
      </Link>

      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <PatientAvatar firstName={patient.firstName} lastName={patient.lastName} size="md" />
            <h1 className="text-2xl font-bold">
              {patient.firstName} {patient.lastName}
            </h1>
          </div>
          <div className="text-gray-600 mt-1">
            {patient.dateOfBirth && (
              <span>
                {new Date(patient.dateOfBirth).toLocaleDateString()} ({formatAge(patient.dateOfBirth)})
              </span>
            )}
            {patient.gender && <span className="ml-3">• {patient.gender}</span>}
          </div>
          <div className="text-gray-600 mt-1">
            {patient.phone && <span>{patient.phone}</span>}
            {patient.email && <span className="ml-3">• {patient.email}</span>}
          </div>
          <PatientTags tags={patient.tags} />
        </div>
      </div>
    </div>
  );
}
