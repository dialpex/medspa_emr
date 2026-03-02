"use client";

import { Calendar, Receipt, Clock } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

type HistoryItem =
  | { type: "appointment"; date: Date; data: PatientTimeline["appointments"][number] }
  | { type: "invoice"; date: Date; data: PatientTimeline["invoices"][number] };

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700",
  Confirmed: "bg-green-100 text-green-700",
  CheckedIn: "bg-yellow-100 text-yellow-700",
  InProgress: "bg-purple-100 text-purple-700",
  Completed: "bg-gray-100 text-gray-700",
  NoShow: "bg-red-100 text-red-700",
  Cancelled: "bg-red-100 text-red-700",
  Draft: "bg-yellow-100 text-yellow-700",
  Sent: "bg-blue-100 text-blue-700",
  PartiallyPaid: "bg-yellow-100 text-yellow-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-gray-100 text-gray-700",
  Refunded: "bg-red-100 text-red-700",
};

export function PatientHistory({
  timeline,
}: {
  timeline: PatientTimeline;
}) {
  const items: HistoryItem[] = [
    ...timeline.appointments.map((a) => ({
      type: "appointment" as const,
      date: a.startTime,
      data: a,
    })),
    ...timeline.invoices.map((i) => ({
      type: "invoice" as const,
      date: i.createdAt,
      data: i,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="size-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        if (item.type === "appointment") {
          const apt = item.data;
          return (
            <div
              key={`apt-${apt.id}`}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Calendar className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">
                  {apt.service?.name || "Appointment"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {apt.provider.name} · {formatTime(apt.startTime)}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <span
                  className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-700"}`}
                >
                  {apt.status}
                </span>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(apt.startTime)}
                </div>
              </div>
            </div>
          );
        }

        const inv = item.data;
        return (
          <div
            key={`inv-${inv.id}`}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <Receipt className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900">
                {inv.invoiceNumber} · {formatCurrency(inv.total)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {inv.paidAt ? `Paid ${formatDate(inv.paidAt)}` : "Unpaid"}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <span
                className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-700"}`}
              >
                {inv.status}
              </span>
              <div className="text-xs text-gray-400 mt-1">
                {formatDate(inv.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
