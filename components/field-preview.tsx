import { type TemplateFieldConfig, groupFieldsIntoRows } from "@/lib/types/charts";

function RequiredAsterisk({ field }: { field: TemplateFieldConfig }) {
  if (!field.required) return null;
  return <span className="text-red-500 ml-0.5">*</span>;
}

export function FieldPreview({ field, clinicLogoUrl }: { field: TemplateFieldConfig; clinicLogoUrl?: string }) {
  const label = field.label || "";
  const inputClass = "w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white";

  if (field.type === "heading") {
    return (
      <div className="pt-4 pb-1 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">{label || "Untitled Section"}</h3>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Long Text<RequiredAsterisk field={field} /></p>
        <div
          className="prose prose-sm max-w-none text-gray-800 break-words"
          dangerouslySetInnerHTML={{ __html: label || "<p>No content</p>" }}
        />
      </div>
    );
  }

  if (field.type === "first-name") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "First Name"}<RequiredAsterisk field={field} /></p>
        <input type="text" disabled placeholder={field.placeholder || "First Name"} className={inputClass} />
      </div>
    );
  }

  if (field.type === "last-name") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Last Name"}<RequiredAsterisk field={field} /></p>
        <input type="text" disabled placeholder={field.placeholder || "Last Name"} className={inputClass} />
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Short Text"}<RequiredAsterisk field={field} /></p>
        <input type="text" disabled placeholder={field.placeholder || label || "Short Text"} className={inputClass} />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Number"}<RequiredAsterisk field={field} /></p>
        <input type="number" disabled placeholder={field.placeholder || label || "0"} className={inputClass} />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Date"}<RequiredAsterisk field={field} /></p>
        <input type="date" disabled placeholder={field.placeholder || ""} className={inputClass} />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Select"}<RequiredAsterisk field={field} /></p>
        <select disabled className={inputClass}>
          <option>Select...</option>
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === "multiselect" || field.type === "json-areas") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Options"}<RequiredAsterisk field={field} /></p>
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <span key={opt} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600">
              {opt}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "checklist") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Checklist"}<RequiredAsterisk field={field} /></p>
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" disabled className="rounded border-gray-300" />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "signature") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Signature"}<RequiredAsterisk field={field} /></p>
        <div className="rounded border-2 border-dashed border-gray-300 h-[120px] flex items-center justify-center text-sm text-gray-400">
          Signature pad
        </div>
      </div>
    );
  }

  if (field.type === "photo-single") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Photo"}<RequiredAsterisk field={field} /></p>
        <div className="rounded border-2 border-dashed border-gray-300 h-[120px] flex items-center justify-center text-sm text-gray-400">
          Photo upload
        </div>
      </div>
    );
  }

  if (field.type === "logo") {
    return (
      <div>
        <div className="flex justify-center">
          {clinicLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={clinicLogoUrl}
              alt="Clinic logo"
              className="max-h-[80px] max-w-[200px] object-contain"
            />
          ) : (
            <div className="rounded border-2 border-dashed border-gray-300 h-[80px] w-[200px] flex items-center justify-center text-sm text-gray-400">
              Logo
            </div>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "photo-pair") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Photos"}<RequiredAsterisk field={field} /></p>
        <div className="grid grid-cols-2 gap-3">
          {(field.photoLabels ?? ["Before", "After"]).map((lbl) => (
            <div key={lbl} className="rounded border-2 border-dashed border-gray-300 h-[120px] flex flex-col items-center justify-center text-sm text-gray-400">
              {lbl}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "json-products") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Products"}<RequiredAsterisk field={field} /></p>
        <div className="rounded border border-gray-300 p-3">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 mb-2">
            <span>Product</span><span>Lot #</span><span>Expiry</span><span>Qty</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Renders fields grouped into visual rows based on their width property */
export function FieldPreviewRows({ fields, clinicLogoUrl }: { fields: TemplateFieldConfig[]; clinicLogoUrl?: string }) {
  const rows = groupFieldsIntoRows(fields);

  return (
    <div className="space-y-5">
      {rows.map((row, ri) => {
        if (row.length === 1 && (row[0].width ?? 100) === 100) {
          return <FieldPreview key={row[0].key} field={row[0]} clinicLogoUrl={clinicLogoUrl} />;
        }
        return (
          <div
            key={row.map((f) => f.key).join("-")}
            className="gap-4"
            style={{
              display: "grid",
              gridTemplateColumns: row.map((f) => `${f.width ?? 100}fr`).join(" "),
            }}
          >
            {row.map((f) => (
              <div key={f.key} className="min-w-0">
                <FieldPreview field={f} clinicLogoUrl={clinicLogoUrl} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
