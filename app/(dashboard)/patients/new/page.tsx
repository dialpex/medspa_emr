"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPatient } from "@/lib/actions/patients";
import { Spinner } from "@/components/ui/spinner";
import { PageCard } from "@/components/ui/page-card";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  allergies: string;
  medicalNotes: string;
  tags: string;
};

const initialForm: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  allergies: "",
  medicalNotes: "",
  tags: "",
};

export default function NewPatientPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormData>(initialForm);
  const [error, setError] = useState<string | null>(null);

  const isDirty = Object.keys(initialForm).some(
    (key) => form[key as keyof FormData] !== initialForm[key as keyof FormData]
  );
  const { showConfirm, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required");
      return;
    }

    startTransition(async () => {
      try {
        const patient = await createPatient(form);
        router.push(`/patients/${patient.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create patient");
      }
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs items={buildBreadcrumbItems(
        { label: "Patient Directory", href: "/patients" },
        { label: "New Patient" }
      )} />

      <PageCard title="Add New Patient">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium text-gray-900 border-b pb-2 mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={form.dateOfBirth}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 border-b pb-2 mb-4">
              Contact Information
            </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={form.zipCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 border-b pb-2 mb-4">
              Medical Information
            </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allergies
              </label>
              <textarea
                name="allergies"
                value={form.allergies}
                onChange={handleChange}
                rows={2}
                placeholder="List any known allergies..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-red-50 border-red-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Notes
              </label>
              <textarea
                name="medicalNotes"
                value={form.medicalNotes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional medical notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <input
                type="text"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="Comma-separated tags (e.g., VIP, Regular)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/patients"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Spinner className="h-4 w-4" />}
              Create Patient
            </button>
          </div>
        </form>
      </PageCard>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Discard changes?</h3>
            <p className="text-sm text-gray-500 mb-5">
              You have unsaved changes. Are you sure you want to leave? Your work will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelNavigation}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Stay on Page
              </button>
              <button
                type="button"
                onClick={confirmNavigation}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
