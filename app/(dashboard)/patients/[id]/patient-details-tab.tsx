"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle,
  MessageSquare,
  CalendarPlus,
  User,
  Sparkles,
  AlertCircle,
  Clock,
  Lightbulb,
} from "lucide-react";
import type { PatientDetail, PatientTimeline } from "@/lib/actions/patients";
import { getPatientSuggestions } from "@/lib/actions/patients";
import { PatientDetails } from "./patient-details";
import { CollapsibleCard } from "@/components/ui/collapsible-card";

interface PatientDetailsTabProps {
  patient: PatientDetail;
  timeline: PatientTimeline;
  canEdit: boolean;
}

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

function timeAgo(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(date);
}

// ─── Quick Actions ───────────────────────────────────────────

function QuickActions({ patientId }: { patientId: string }) {
  const actions = [
    {
      label: "Check-in",
      subtitle: "Arrived at front desk",
      icon: CheckCircle,
      color: "bg-green-100 text-green-600",
      href: `/appointments?patientId=${patientId}`,
    },
    {
      label: "Message",
      subtitle: "Send SMS",
      icon: MessageSquare,
      color: "bg-purple-100 text-purple-600",
      href: `/communications?patientId=${patientId}`,
    },
    {
      label: "Schedule",
      subtitle: "Book next appointment",
      icon: CalendarPlus,
      color: "bg-orange-100 text-orange-600",
      href: `/appointments/new?patientId=${patientId}`,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div
                className={`size-9 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{action.label}</div>
                <div className="text-xs text-gray-500">{action.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Next Appointment ────────────────────────────────────────

function NextAppointment({
  appointments,
}: {
  appointments: PatientTimeline["appointments"];
}) {
  const now = new Date();
  const upcoming = appointments
    .filter(
      (a) =>
        new Date(a.startTime) > now &&
        (a.status === "Scheduled" || a.status === "Confirmed")
    )
    .sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  const next = upcoming[0];

  if (!next) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Next Appointment
        </h3>
        <p className="text-sm text-gray-400">No upcoming appointments</p>
      </div>
    );
  }

  const startDate = new Date(next.startTime);
  const endDate = new Date(next.endTime);
  const durationMins = Math.round(
    (endDate.getTime() - startDate.getTime()) / 60000
  );
  const monthAbbr = startDate
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const dayNum = startDate.getDate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Next Appointment
      </h3>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 size-12 rounded-full bg-purple-100 text-purple-700 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold leading-none">{monthAbbr}</span>
          <span className="text-lg font-bold leading-tight">{dayNum}</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">
            {next.service?.name ?? "Appointment"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatTime(next.startTime)} · {durationMins} min
          </div>
          <div className="text-xs text-gray-500">
            {next.provider.name}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Patient Info Card ───────────────────────────────────────

function PatientInfoCard({
  patient,
  canEdit,
}: {
  patient: PatientDetail;
  canEdit: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const editButton =
    canEdit && !isEditing ? (
      <button
        onClick={() => setIsEditing(true)}
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
      >
        Edit
      </button>
    ) : null;

  return (
    <CollapsibleCard
      icon={User}
      title="Patient Information"
      subtitle={`Edited ${timeAgo(patient.updatedAt)}`}
      headerAction={editButton}
    >
      <PatientDetails
        patient={patient}
        canEdit={canEdit}
        isEditing={isEditing}
        onEditChange={setIsEditing}
      />
    </CollapsibleCard>
  );
}

// ─── Smart Suggestions ──────────────────────────────────────

const URGENCY_CONFIG = {
  high: { icon: AlertCircle, color: "text-red-600", badge: "bg-red-100 text-red-700" },
  medium: { icon: Clock, color: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  low: { icon: Lightbulb, color: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
} as const;

function SmartSuggestions({ patientId }: { patientId: string }) {
  const [suggestions, setSuggestions] = useState<
    { title: string; reason: string; urgency: "high" | "medium" | "low" }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPatientSuggestions(patientId)
      .then((data) => {
        if (!cancelled) setSuggestions(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [patientId]);

  if (!loading && suggestions.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-gray-900">AI Insights</h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-purple-100 rounded w-3/4" />
              <div className="h-3 bg-purple-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion, i) => {
            const config = URGENCY_CONFIG[suggestion.urgency];
            const Icon = config.icon;
            return (
              <div key={i} className="flex items-start gap-2.5">
                <Icon className={`size-4 flex-shrink-0 mt-0.5 ${config.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{suggestion.title}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.badge}`}>
                      {suggestion.urgency}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{suggestion.reason}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────

export function PatientDetailsTab({
  patient,
  timeline,
  canEdit,
}: PatientDetailsTabProps) {
  return (
    <div className="flex gap-6">
      {/* Left column */}
      <div className="w-[340px] flex-shrink-0 space-y-4">
        <QuickActions patientId={patient.id} />
        <NextAppointment appointments={timeline.appointments} />
        <SmartSuggestions patientId={patient.id} />
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0">
        <PatientInfoCard patient={patient} canEdit={canEdit} />
      </div>
    </div>
  );
}
