"use client";

import { useState } from "react";
import { LocationData, updateLocationData } from "@/lib/actions/location";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const hh = h.toString().padStart(2, "0");
  return `${hh}:${m}`;
});

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none";
const selectCls = inputCls;

export function LocationForm({ initialData }: { initialData: LocationData }) {
  const [data, setData] = useState<LocationData>(initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof LocationData>(key: K, value: LocationData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function setHour(day: string, field: "enabled" | "start" | "end", value: string | boolean) {
    setData((d) => ({
      ...d,
      locationHours: {
        ...d.locationHours,
        [day]: { ...d.locationHours[day], [field]: value },
      },
    }));
    setSaved(false);
  }

  function setSocial(key: string, value: string) {
    setData((d) => ({
      ...d,
      socialAccounts: { ...d.socialAccounts, [key]: value },
    }));
    setSaved(false);
  }

  function setCal(key: string, value: string) {
    setData((d) => ({
      ...d,
      calendarSettings: { ...d.calendarSettings, [key]: value },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateLocationData(data);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Location Info */}
      <Section title="Location Info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name" className="sm:col-span-2">
            <input className={inputCls} value={data.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Location Name">
            <input className={inputCls} value={data.locationName} onChange={(e) => set("locationName", e.target.value)} placeholder="e.g. Main Office" />
          </Field>
          <Field label="External ID">
            <input className={inputCls} value={data.externalId} onChange={(e) => set("externalId", e.target.value)} />
          </Field>
          <Field label="Street Address" className="sm:col-span-2">
            <input className={inputCls} value={data.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Suite / Unit" className="sm:col-span-2">
            <input className={inputCls} value={data.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
          </Field>
          <Field label="City">
            <input className={inputCls} value={data.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <input className={inputCls} value={data.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="Zip Code">
              <input className={inputCls} value={data.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
            </Field>
          </div>
          <Field label="Country">
            <select className={selectCls} value={data.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Timezone">
            <select className={selectCls} value={data.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Contact Email">
            <input className={inputCls} type="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} type="tel" value={data.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <input className={inputCls} value={data.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Default Tax Rate (%)">
            <input className={inputCls} type="number" min={0} step={0.1} value={data.defaultTaxRate} onChange={(e) => set("defaultTaxRate", parseFloat(e.target.value) || 0)} placeholder="e.g. 6" />
          </Field>
        </div>
      </Section>

      {/* Location Hours */}
      <Section title="Location Hours">
        <div className="space-y-3">
          {DAYS.map((day) => {
            const h = data.locationHours[day.key] ?? { enabled: false, start: "09:00", end: "17:00" };
            return (
              <div key={day.key} className="flex items-center gap-4">
                <label className="flex items-center gap-2 w-28">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => setHour(day.key, "enabled", e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{day.label}</span>
                </label>
                {h.enabled && (
                  <>
                    <select className={`${selectCls} w-28`} value={h.start} onChange={(e) => setHour(day.key, "start", e.target.value)}>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span className="text-gray-400">to</span>
                    <select className={`${selectCls} w-28`} value={h.end} onChange={(e) => setHour(day.key, "end", e.target.value)}>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </>
                )}
                {!h.enabled && <span className="text-sm text-gray-400">Closed</span>}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Social Accounts */}
      <Section title="Social Accounts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: "yelp", label: "Yelp" },
            { key: "facebook", label: "Facebook" },
            { key: "instagram", label: "Instagram" },
            { key: "twitter", label: "Twitter / X" },
            { key: "youtube", label: "YouTube" },
            { key: "pinterest", label: "Pinterest" },
            { key: "googlePlaceId", label: "Google Place ID" },
          ].map((s) => (
            <Field key={s.key} label={s.label}>
              <input className={inputCls} value={data.socialAccounts[s.key] ?? ""} onChange={(e) => setSocial(s.key, e.target.value)} placeholder={s.key === "googlePlaceId" ? "Place ID" : `${s.label} URL`} />
            </Field>
          ))}
        </div>
      </Section>

      {/* Calendar Settings */}
      <Section title="Calendar Settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Time Interval">
            <select className={selectCls} value={data.calendarSettings.timeInterval} onChange={(e) => setCal("timeInterval", e.target.value)}>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </Field>
          <Field label="First Day of Week">
            <select className={selectCls} value={data.calendarSettings.firstDayOfWeek} onChange={(e) => setCal("firstDayOfWeek", e.target.value)}>
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
              <option value="saturday">Saturday</option>
            </select>
          </Field>
          <Field label="Calendar Start Time">
            <select className={selectCls} value={data.calendarSettings.startTime} onChange={(e) => setCal("startTime", e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Calendar End Time">
            <select className={selectCls} value={data.calendarSettings.endTime} onChange={(e) => setCal("endTime", e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Appointment Color Usage" className="sm:col-span-2">
            <select className={selectCls} value={data.calendarSettings.colorUsage} onChange={(e) => setCal("colorUsage", e.target.value)}>
              <option value="service">By Service</option>
              <option value="provider">By Provider</option>
              <option value="status">By Status</option>
              <option value="room">By Room</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved successfully</span>}
      </div>
    </div>
  );
}
