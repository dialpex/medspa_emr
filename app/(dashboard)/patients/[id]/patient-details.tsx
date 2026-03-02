"use client";

import { useState, useTransition } from "react";
import { updatePatient, type PatientDetail } from "@/lib/actions/patients";
import { Spinner } from "@/components/ui/spinner";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  allergies: string;
  medicalNotes: string;
  tags: string;
};

function patientToForm(patient: PatientDetail): FormData {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email ?? "",
    phone: patient.phone ?? "",
    dateOfBirth: patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toISOString().split("T")[0]
      : "",
    gender: patient.gender ?? "",
    status: patient.status ?? "Active",
    address: patient.address ?? "",
    city: patient.city ?? "",
    state: patient.state ?? "",
    zipCode: patient.zipCode ?? "",
    allergies: patient.allergies ?? "",
    medicalNotes: patient.medicalNotes ?? "",
    tags: patient.tags ?? "",
  };
}

export function PatientDetails({
  patient,
  canEdit,
  isEditing,
  onEditChange,
}: {
  patient: PatientDetail;
  canEdit: boolean;
  isEditing?: boolean;
  onEditChange?: (editing: boolean) => void;
}) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = isEditing ?? internalEditing;
  const setEditing = onEditChange ?? setInternalEditing;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormData>(patientToForm(patient));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updatePatient(patient.id, form);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update patient");
      }
    });
  };

  const handleCancel = () => {
    setForm(patientToForm(patient));
    setEditing(false);
    setError(null);
  };

  return (
    <div>
      {editing && (
        <div className="flex justify-end items-center mb-3">
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Spinner className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 border-b pb-2">Basic Information</h3>

          <Field
            label="First Name"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            isEditing={editing}
            required
          />
          <Field
            label="Last Name"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            isEditing={editing}
            required
          />
          <Field
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={handleChange}
            isEditing={editing}
          />
          <SelectField
            label="Gender"
            name="gender"
            value={form.gender}
            onChange={handleChange}
            isEditing={editing}
            options={[
              { value: "", label: "Select..." },
              { value: "Female", label: "Female" },
              { value: "Male", label: "Male" },
              { value: "Other", label: "Other" },
            ]}
          />
          <SelectField
            label="Status"
            name="status"
            value={form.status}
            onChange={handleChange}
            isEditing={editing}
            options={[
              { value: "Active", label: "Active" },
              { value: "Fired", label: "Fired" },
            ]}
          />
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 border-b pb-2">Contact Information</h3>

          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            isEditing={editing}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            isEditing={editing}
          />
          <Field
            label="Address"
            name="address"
            value={form.address}
            onChange={handleChange}
            isEditing={editing}
          />
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
              isEditing={editing}
            />
            <Field
              label="State"
              name="state"
              value={form.state}
              onChange={handleChange}
              isEditing={editing}
            />
            <Field
              label="ZIP"
              name="zipCode"
              value={form.zipCode}
              onChange={handleChange}
              isEditing={editing}
            />
          </div>
        </div>

        {/* Medical Info */}
        <div className="md:col-span-2">
          <h3 className="font-medium text-gray-900 border-b pb-2 mb-4">Medical Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextAreaField
              label="Allergies"
              name="allergies"
              value={form.allergies}
              onChange={handleChange}
              isEditing={editing}
              placeholder="List any known allergies..."
              className="bg-red-50 border-red-200"
            />
            <TextAreaField
              label="Medical Notes"
              name="medicalNotes"
              value={form.medicalNotes}
              onChange={handleChange}
              isEditing={editing}
              placeholder="Additional medical notes..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  isEditing,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEditing: boolean;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {isEditing ? (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      ) : (
        <div className="text-gray-900 py-2">{value || "—"}</div>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  isEditing,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  isEditing: boolean;
  options: { value: string; label: string }[];
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label || "—";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {isEditing ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="text-gray-900 py-2">{selectedLabel}</div>
      )}
    </div>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
  isEditing,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isEditing: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {isEditing ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
        />
      ) : (
        <div className={`text-gray-900 py-2 whitespace-pre-wrap ${value ? "" : "text-gray-400"}`}>
          {value || "—"}
        </div>
      )}
    </div>
  );
}
