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
  pronouns: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  allergies: string;
  medicalNotes: string;
  tags: string;
  referralSource: string;
  smsOptIn: boolean;
  emailOptIn: boolean;
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
    pronouns: patient.pronouns ?? "",
    status: patient.status ?? "Active",
    address: patient.address ?? "",
    city: patient.city ?? "",
    state: patient.state ?? "",
    zipCode: patient.zipCode ?? "",
    allergies: patient.allergies ?? "",
    medicalNotes: patient.medicalNotes ?? "",
    tags: patient.tags ?? "",
    referralSource: patient.referralSource ?? "",
    smsOptIn: patient.smsOptIn ?? false,
    emailOptIn: patient.emailOptIn ?? false,
  };
}

// --- Formatting helpers ---

function formatDOBDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return formatted;
}

function formatLocation(city: string, state: string, zip: string): string {
  const parts: string[] = [];
  if (city && state) parts.push(`${city}, ${state}`);
  else if (city) parts.push(city);
  else if (state) parts.push(state);
  if (zip) parts.push(zip);
  return parts.join(" ");
}

// --- Sub-components ---

function CardShell({
  sectionLabel,
  title,
  canEdit,
  editing,
  onEdit,
  onCancel,
  onSave,
  isPending,
  children,
}: {
  sectionLabel: string;
  title: string;
  canEdit: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
            {sectionLabel}
          </div>
          <h2 className="text-sm font-semibold text-gray-900 mt-0.5">{title}</h2>
        </div>
        {canEdit && !editing && (
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1">{children}</div>

      {editing && (
        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Spinner className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-1">
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available
    }
  };

  if (!text) return null;

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 shrink-0 ml-2"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

function TagPills({ tags }: { tags: string }) {
  if (!tags) return <span className="text-sm text-gray-400">—</span>;
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (tagList.length === 0) return <span className="text-sm text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tagList.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function AllergyPills({ allergies }: { allergies: string }) {
  if (!allergies) {
    return <span className="text-sm text-gray-400 italic">None reported</span>;
  }
  const list = allergies.split(",").map((a) => a.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((allergy) => (
        <span
          key={allergy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 max-w-[200px]"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="truncate">{allergy}</span>
        </span>
      ))}
    </div>
  );
}

function OptInToggle({
  label,
  checked,
  onChange,
  editing,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  editing: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      {editing ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
      ) : (
        <span className={`inline-flex items-center justify-center h-4 w-4 rounded ${
          checked ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
        }`}>
          {checked ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </span>
      )}
      <span className="text-xs text-gray-500">{label}</span>
    </label>
  );
}

// --- Input style ---

const inputBase =
  "w-full border-0 border-b border-gray-200 focus:border-purple-500 focus:ring-0 bg-transparent text-sm text-gray-900 py-1 px-0 outline-none transition-colors";

const selectBase =
  "w-full border-0 border-b border-gray-200 focus:border-purple-500 focus:ring-0 bg-transparent text-sm text-gray-900 py-1 px-0 outline-none transition-colors appearance-none";

const textareaBase =
  "w-full border-0 border-b border-gray-200 focus:border-purple-500 focus:ring-0 bg-transparent text-sm text-gray-900 py-1 px-0 outline-none transition-colors resize-none";

// --- Main component ---

export function PatientDetails({
  patient,
  canEdit,
}: {
  patient: PatientDetail;
  canEdit: boolean;
  isEditing?: boolean;
  onEditChange?: (editing: boolean) => void;
}) {
  const [editingCard, setEditingCard] = useState<"personal" | "health" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormData>(patientToForm(patient));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleToggle = (field: "smsOptIn" | "emailOptIn", checked: boolean) => {
    setForm((prev) => ({ ...prev, [field]: checked }));
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updatePatient(patient.id, form);
        setEditingCard(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update patient");
      }
    });
  };

  const handleCancel = () => {
    setForm(patientToForm(patient));
    setEditingCard(null);
    setError(null);
  };

  const genderOptions = [
    { value: "", label: "Select..." },
    { value: "Female", label: "Female" },
    { value: "Male", label: "Male" },
    { value: "Other", label: "Other" },
  ];

  const editingPersonal = editingCard === "personal";
  const editingHealth = editingCard === "health";

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Personal & Contact Card ─── */}
        <CardShell
          sectionLabel="Personal"
          title="Basic Information"
          canEdit={canEdit && editingCard === null}
          editing={editingPersonal}
          onEdit={() => setEditingCard("personal")}
          onCancel={handleCancel}
          onSave={handleSave}
          isPending={isPending}
        >
          {/* Name + DOB — horizontal */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <FieldLabel>First Name</FieldLabel>
              {editingPersonal ? (
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                  required
                  className={inputBase}
                />
              ) : (
                <div className="text-sm font-medium text-gray-900">{form.firstName}</div>
              )}
            </div>
            <div>
              <FieldLabel>Last Name</FieldLabel>
              {editingPersonal ? (
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                  required
                  className={inputBase}
                />
              ) : (
                <div className="text-sm font-medium text-gray-900">{form.lastName}</div>
              )}
            </div>
            <div>
              <FieldLabel>Date of Birth</FieldLabel>
              {editingPersonal ? (
                <input
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  className={inputBase}
                />
              ) : (
                <div className="text-sm font-medium text-gray-900">
                  {form.dateOfBirth ? formatDOBDisplay(form.dateOfBirth) : "—"}
                </div>
              )}
            </div>
          </div>

          {/* Gender + Pronouns */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <FieldLabel>Gender</FieldLabel>
              {editingPersonal ? (
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className={selectBase}
                >
                  {genderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm font-medium text-gray-900">
                  {genderOptions.find((o) => o.value === form.gender)?.label || "—"}
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Pronouns</FieldLabel>
              {editingPersonal ? (
                <input
                  type="text"
                  name="pronouns"
                  value={form.pronouns}
                  onChange={handleChange}
                  placeholder="e.g. she/her"
                  className={inputBase}
                />
              ) : (
                <div className="text-sm font-medium text-gray-900">
                  {form.pronouns || <span className="text-gray-400 font-normal">—</span>}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 my-3" />

          {/* Email + Phone — horizontal */}
          <div className="grid grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <div className="group/copy">
                <FieldLabel>Email Address</FieldLabel>
                {editingPersonal ? (
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputBase}
                  />
                ) : (
                  <div className="flex items-center text-sm font-medium text-gray-900">
                    <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{form.email || "—"}</span>
                    <CopyButton text={form.email} />
                  </div>
                )}
              </div>
              <div className="mt-1.5 ml-5">
                <OptInToggle
                  label="Email notifications"
                  checked={form.emailOptIn}
                  onChange={(v) => handleToggle("emailOptIn", v)}
                  editing={editingPersonal}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <div className="group/copy">
                <FieldLabel>Phone Number</FieldLabel>
                {editingPersonal ? (
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputBase}
                  />
                ) : (
                  <div className="flex items-center text-sm font-medium text-gray-900">
                    <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{form.phone || "—"}</span>
                    <CopyButton text={form.phone} />
                  </div>
                )}
              </div>
              <div className="mt-1.5 ml-5">
                <OptInToggle
                  label="Text notifications"
                  checked={form.smsOptIn}
                  onChange={(v) => handleToggle("smsOptIn", v)}
                  editing={editingPersonal}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 my-3" />

          {/* Address */}
          <div className="mb-4">
            <FieldLabel>Home Address</FieldLabel>
            {editingPersonal ? (
              <div className="space-y-2">
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Street address"
                  className={inputBase}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="City"
                    className={`${inputBase} flex-1`}
                  />
                  <input
                    type="text"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder="ST"
                    className={`${inputBase} w-14`}
                  />
                  <input
                    type="text"
                    name="zipCode"
                    value={form.zipCode}
                    onChange={handleChange}
                    placeholder="ZIP"
                    className={`${inputBase} w-20`}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-900">
                {form.address ? (
                  <>
                    <div className="font-medium">{form.address}</div>
                    {formatLocation(form.city, form.state, form.zipCode) && (
                      <div className="text-gray-500">{formatLocation(form.city, form.state, form.zipCode)}</div>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 my-3" />

          {/* Referral Source */}
          <div>
            <FieldLabel>Referral Source</FieldLabel>
            {editingPersonal ? (
              <input
                type="text"
                name="referralSource"
                value={form.referralSource}
                onChange={handleChange}
                placeholder="e.g. Google, Friend, Instagram"
                className={inputBase}
              />
            ) : (
              <div className="text-sm font-medium text-gray-900">
                {form.referralSource || <span className="text-gray-400 font-normal">—</span>}
              </div>
            )}
          </div>
        </CardShell>

        {/* ─── Health & Tags Card ─── */}
        <CardShell
          sectionLabel="Medical"
          title="Health & Safety"
          canEdit={canEdit && editingCard === null}
          editing={editingHealth}
          onEdit={() => setEditingCard("health")}
          onCancel={handleCancel}
          onSave={handleSave}
          isPending={isPending}
        >
          {/* Allergies */}
          <div className="mb-5">
            <FieldLabel>Active Allergies</FieldLabel>
            {editingHealth ? (
              <textarea
                name="allergies"
                value={form.allergies}
                onChange={handleChange}
                placeholder="Comma-separated (e.g. Latex, Penicillin)"
                rows={2}
                className={textareaBase}
              />
            ) : (
              <AllergyPills allergies={form.allergies} />
            )}
          </div>

          <div className="border-t border-gray-100 my-3" />

          {/* Medical Notes */}
          <div className="mb-5">
            <FieldLabel>Medical Notes</FieldLabel>
            {editingHealth ? (
              <textarea
                name="medicalNotes"
                value={form.medicalNotes}
                onChange={handleChange}
                placeholder="Additional medical notes..."
                rows={3}
                className={textareaBase}
              />
            ) : form.medicalNotes ? (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 italic line-clamp-3">
                {form.medicalNotes}
              </div>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </div>

          <div className="border-t border-gray-100 my-3" />

          {/* Tags */}
          <div>
            <FieldLabel>Assigned Tags</FieldLabel>
            {editingHealth ? (
              <input
                type="text"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="Comma-separated (e.g. VIP, Sensitive)"
                className={inputBase}
              />
            ) : (
              <TagPills tags={form.tags} />
            )}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
