"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, Loader2Icon } from "lucide-react";
import { getTemplates } from "@/lib/actions/chart-templates";
import { createChart } from "@/lib/actions/charts";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
};

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
};

export default function NewChartPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTemplates().then(setTemplates);
  }, []);

  // Load patients from server action
  useEffect(() => {
    import("@/lib/actions/patients").then(({ getPatients }) => {
      getPatients("").then((result) => {
        if (Array.isArray(result)) setPatients(result);
      });
    });
  }, []);

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true;
    const q = patientSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    if (!selectedPatient) {
      setError("Please select a patient");
      return;
    }
    setCreating(true);
    setError("");

    const result = await createChart({
      patientId: selectedPatient,
      templateId: selectedTemplate || undefined,
    });

    if (result.success && result.data) {
      router.push(`/charts/${result.data.id}/edit`);
    } else {
      setError(result.error ?? "Failed to create chart");
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Chart</h1>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Patient Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient
          </label>
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Search patients..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
            {filteredPatients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPatient(p.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  selectedPatient === p.id
                    ? "bg-purple-50 text-purple-700 font-medium"
                    : "text-gray-700"
                }`}
              >
                {p.firstName} {p.lastName}
              </button>
            ))}
            {filteredPatients.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No patients found
              </div>
            )}
          </div>
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template (optional)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedTemplate("")}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left ${
                !selectedTemplate
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <FileTextIcon className="size-5 text-gray-400" />
              <div>
                <div className="text-sm font-medium">Blank Chart</div>
                <div className="text-xs text-gray-500">Free-form charting</div>
              </div>
            </button>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left ${
                  selectedTemplate === t.id
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <FileTextIcon className="size-5 text-purple-500" />
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  {t.description && (
                    <div className="text-xs text-gray-500">{t.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleCreate}
            disabled={creating || !selectedPatient}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {creating && <Loader2Icon className="size-4 animate-spin" />}
            Create Chart
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
