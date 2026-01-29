"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { updateChart, submitChartForReview } from "@/lib/actions/charts";
import { ChartFormFields } from "./chart-form-fields";
import { PhotoUpload } from "./photo-upload";
import { PhotoGallery } from "./photo-gallery";
import type { TemplateFieldConfig } from "@/lib/types/charts";
import type { Role } from "@prisma/client";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

type ChartData = {
  id: string;
  status: string;
  patientId: string;
  chiefComplaint: string | null;
  areasTreated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;
  technique: string | null;
  aftercareNotes: string | null;
  additionalNotes: string | null;
  patient: { firstName: string; lastName: string; allergies: string | null };
  template: { name: string; fieldsConfig: string } | null;
  photos: Array<{
    id: string;
    filename: string;
    category: string | null;
    annotations: string | null;
    createdAt: Date;
  }>;
};

export function ChartEditor({
  chart,
  currentUserRole,
}: {
  chart: ChartData;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Standard chart fields
  const [chiefComplaint, setChiefComplaint] = useState(chart.chiefComplaint ?? "");
  const [areasTreated, setAreasTreated] = useState(chart.areasTreated ?? "");
  const [productsUsed, setProductsUsed] = useState(chart.productsUsed ?? "");
  const [dosageUnits, setDosageUnits] = useState(chart.dosageUnits ?? "");
  const [technique, setTechnique] = useState(chart.technique ?? "");
  const [aftercareNotes, setAftercare] = useState(chart.aftercareNotes ?? "");
  const [additionalNotes, setAdditional] = useState(chart.additionalNotes ?? "");

  // Template custom fields stored in additionalNotes as JSON when template is used
  const [templateValues, setTemplateValues] = useState<Record<string, string>>(() => {
    if (chart.template && chart.additionalNotes) {
      try {
        return JSON.parse(chart.additionalNotes);
      } catch {
        return {};
      }
    }
    return {};
  });

  const templateFields: TemplateFieldConfig[] = chart.template
    ? JSON.parse(chart.template.fieldsConfig)
    : [];

  const [photos, setPhotos] = useState(chart.photos);

  const autoSave = useCallback(
    (data: Record<string, string | undefined>) => {
      setSaveStatus("unsaved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await updateChart(chart.id, data);
        setSaveStatus(result.success ? "saved" : "error");
      }, 2000);
    },
    [chart.id]
  );

  const handleStandardChange = (field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      chiefComplaint: setChiefComplaint,
      areasTreated: setAreasTreated,
      productsUsed: setProductsUsed,
      dosageUnits: setDosageUnits,
      technique: setTechnique,
      aftercareNotes: setAftercare,
      additionalNotes: setAdditional,
    };
    setters[field]?.(value);
    autoSave({ [field]: value });
  };

  const handleTemplateChange = (key: string, value: string) => {
    const newValues = { ...templateValues, [key]: value };
    setTemplateValues(newValues);
    autoSave({ additionalNotes: JSON.stringify(newValues) });
  };

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    const result = await submitChartForReview(chart.id);
    if (result.success) {
      router.push(`/charts/${chart.id}`);
      router.refresh();
    }
    setSubmitting(false);
  };

  const refreshPhotos = () => {
    import("@/lib/actions/charts").then(({ getChartWithPhotos }) => {
      getChartWithPhotos(chart.id).then((c) => {
        if (c) setPhotos(c.photos);
      });
    });
  };

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isSigned = chart.status === "MDSigned";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Chart: {chart.patient.firstName} {chart.patient.lastName}
          </h1>
          {chart.template && (
            <p className="text-sm text-gray-500 mt-1">
              Template: {chart.template.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Save status */}
          <div className="flex items-center gap-1.5 text-sm">
            {saveStatus === "saved" && (
              <>
                <CheckCircleIcon className="size-4 text-green-500" />
                <span className="text-green-600">Saved</span>
              </>
            )}
            {saveStatus === "saving" && (
              <>
                <Loader2Icon className="size-4 animate-spin text-gray-400" />
                <span className="text-gray-500">Saving...</span>
              </>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-amber-600">Unsaved changes</span>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircleIcon className="size-4 text-red-500" />
                <span className="text-red-600">Save failed</span>
              </>
            )}
          </div>
          {chart.status === "Draft" && (
            <button
              onClick={handleSubmitForReview}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting && <Loader2Icon className="size-4 animate-spin" />}
              Submit for Review
            </button>
          )}
        </div>
      </div>

      {/* Allergies warning */}
      {chart.patient.allergies && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircleIcon className="size-4 text-red-500" />
          <span className="text-sm text-red-700">
            <strong>Allergies:</strong> {chart.patient.allergies}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Standard fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Chart Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chief Complaint
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => handleStandardChange("chiefComplaint", e.target.value)}
                disabled={isSigned}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder="Reason for visit..."
              />
            </div>

            {!chart.template && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Areas Treated
                  </label>
                  <input
                    type="text"
                    value={areasTreated}
                    onChange={(e) => handleStandardChange("areasTreated", e.target.value)}
                    disabled={isSigned}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                    placeholder='JSON array e.g. ["Forehead", "Glabella"]'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Products Used
                  </label>
                  <textarea
                    value={productsUsed}
                    onChange={(e) => handleStandardChange("productsUsed", e.target.value)}
                    disabled={isSigned}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                    placeholder="JSON array of products..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dosage/Units
                  </label>
                  <input
                    type="text"
                    value={dosageUnits}
                    onChange={(e) => handleStandardChange("dosageUnits", e.target.value)}
                    disabled={isSigned}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Technique
                  </label>
                  <textarea
                    value={technique}
                    onChange={(e) => handleStandardChange("technique", e.target.value)}
                    disabled={isSigned}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aftercare Notes
                  </label>
                  <textarea
                    value={aftercareNotes}
                    onChange={(e) => handleStandardChange("aftercareNotes", e.target.value)}
                    disabled={isSigned}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => handleStandardChange("additionalNotes", e.target.value)}
                    disabled={isSigned}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  />
                </div>
              </>
            )}
          </div>

          {/* Template-driven fields */}
          {chart.template && templateFields.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                {chart.template.name} Fields
              </h2>
              <ChartFormFields
                fields={templateFields}
                values={templateValues}
                onChange={handleTemplateChange}
                disabled={isSigned}
              />
            </div>
          )}
        </div>

        {/* Sidebar — Photos */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Photos</h2>
            {!isSigned && (
              <div className="mb-4">
                <PhotoUpload
                  chartId={chart.id}
                  patientId={chart.patientId}
                  onUploaded={refreshPhotos}
                />
              </div>
            )}
            <PhotoGallery photos={photos} onRefresh={refreshPhotos} />
          </div>
        </div>
      </div>
    </div>
  );
}
