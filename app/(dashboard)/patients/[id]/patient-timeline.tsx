"use client";

import { useState } from "react";
import type { PatientTimeline as TimelineData } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

type SectionProps = {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function CollapsibleSection({ title, count, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 flex justify-between items-center hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium">
          {title} <span className="text-gray-500">({count})</span>
        </span>
        <span className="text-gray-400">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}

function StatusBadge({ status, type }: { status: string; type: "appointment" | "chart" | "invoice" }) {
  const colors: Record<string, string> = {
    // Appointments
    Scheduled: "bg-blue-100 text-blue-700",
    Confirmed: "bg-green-100 text-green-700",
    CheckedIn: "bg-yellow-100 text-yellow-700",
    InProgress: "bg-purple-100 text-purple-700",
    Completed: "bg-gray-100 text-gray-700",
    NoShow: "bg-red-100 text-red-700",
    Cancelled: "bg-red-100 text-red-700",
    // Charts
    Draft: "bg-yellow-100 text-yellow-700",
    NeedsSignOff: "bg-orange-100 text-orange-700",
    MDSigned: "bg-green-100 text-green-700",
    // Invoices
    Sent: "bg-blue-100 text-blue-700",
    PartiallyPaid: "bg-yellow-100 text-yellow-700",
    Paid: "bg-green-100 text-green-700",
    Void: "bg-gray-100 text-gray-700",
    Refunded: "bg-red-100 text-red-700",
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export function PatientTimeline({ timeline }: { timeline: TimelineData }) {
  return (
    <div className="space-y-4">
      {/* Appointments */}
      <CollapsibleSection title="Appointments" count={timeline.appointments.length}>
        {timeline.appointments.length === 0 ? (
          <p className="text-gray-500 text-sm">No appointments</p>
        ) : (
          <div className="space-y-3">
            {timeline.appointments.map((apt) => (
              <div
                key={apt.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {apt.service?.name || "Appointment"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDateTime(apt.startTime)} • {apt.provider.name}
                  </div>
                </div>
                <StatusBadge status={apt.status} type="appointment" />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Charts */}
      <CollapsibleSection title="Charts" count={timeline.charts.length}>
        {timeline.charts.length === 0 ? (
          <p className="text-gray-500 text-sm">No charts</p>
        ) : (
          <div className="space-y-3">
            {timeline.charts.map((chart) => (
              <div
                key={chart.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {chart.chiefComplaint || "Treatment Note"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(chart.createdAt)} • {chart.createdBy.name}
                    {chart.signedBy && (
                      <span className="ml-2">
                        • Signed by {chart.signedBy.name}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={chart.status} type="chart" />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Photos */}
      <CollapsibleSection title="Photos" count={timeline.photos.length}>
        {timeline.photos.length === 0 ? (
          <p className="text-gray-500 text-sm">No photos</p>
        ) : (
          <div className="space-y-3">
            {timeline.photos.map((photo) => (
              <div
                key={photo.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {photo.category || "Photo"}
                    {photo.caption && (
                      <span className="font-normal text-gray-600">
                        {" "}
                        - {photo.caption}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(photo.createdAt)} • {photo.takenBy.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Consents */}
      <CollapsibleSection title="Consents" count={timeline.consents.length}>
        {timeline.consents.length === 0 ? (
          <p className="text-gray-500 text-sm">No consents</p>
        ) : (
          <div className="space-y-3">
            {timeline.consents.map((consent) => (
              <div
                key={consent.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">{consent.template.name}</div>
                  <div className="text-sm text-gray-600">
                    {consent.signedAt
                      ? `Signed ${formatDateTime(consent.signedAt)}`
                      : `Created ${formatDate(consent.createdAt)} - Pending signature`}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    consent.signedAt
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {consent.signedAt ? "Signed" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Invoices */}
      <CollapsibleSection title="Invoices" count={timeline.invoices.length}>
        {timeline.invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No invoices</p>
        ) : (
          <div className="space-y-3">
            {timeline.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {invoice.invoiceNumber} • {formatCurrency(invoice.total)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(invoice.createdAt)}
                    {invoice.paidAt && ` • Paid ${formatDate(invoice.paidAt)}`}
                  </div>
                </div>
                <StatusBadge status={invoice.status} type="invoice" />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
