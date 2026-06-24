"use client";

import Link from "next/link";
import {
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  AlertTriangleIcon,
  SparklesIcon,
  TagIcon,
  ActivityIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
} from "lucide-react";
import type { AppointmentDetail, PatientTransaction } from "@/lib/actions/appointments";
import type { JourneyPhase } from "@/lib/today-utils";
import { PatientAvatar } from "@/components/patient-avatar";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function calculateAge(dob: Date): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(start: Date, end: Date): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatTimestamp(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Status badge (used by both panels) ─────────────────────

const PHASE_CONFIG = {
  upcoming: { label: "Upcoming", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  here: { label: "Here", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  with_provider: { label: "With Provider", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  done: { label: "Done", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  no_show: { label: "No Show", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
} as const;

// Map raw AppointmentStatus to a display-friendly phase for the badge
function statusToPhase(status: string): JourneyPhase | null {
  const map: Record<string, JourneyPhase> = {
    Scheduled: "upcoming",
    Confirmed: "upcoming",
    CheckedIn: "here",
    InProgress: "with_provider",
    Completed: "done",
    NoShow: "no_show",
    Cancelled: "cancelled",
  };
  return map[status] ?? null;
}

// ─── Shared Content Component ───────────────────────────────

export type AppointmentPanelContentProps = {
  detail: AppointmentDetail & {
    patientAvatarPhotoId?: string | null;
    patientMedicalNotes?: string | null;
  };
  transactions: PatientTransaction[];
  /** Journey phase — pass from Today panel; calendar panel derives from status */
  phase?: JourneyPhase | null;
  /** Journey timestamps — only shown on Today panel */
  journeyTimestamps?: {
    checkedInAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    checkedOutAt: Date | null;
  } | null;
};

export function AppointmentPanelContent({
  detail,
  transactions,
  phase: phaseProp,
  journeyTimestamps,
}: AppointmentPanelContentProps) {
  // Derive phase from status if not explicitly provided
  const phase = phaseProp ?? statusToPhase(detail.status);
  const avatarUrl = detail.patientAvatarPhotoId
    ? `/api/photos/${detail.patientAvatarPhotoId}`
    : undefined;

  const hasAnyTimestamp = journeyTimestamps && (
    journeyTimestamps.checkedInAt ||
    journeyTimestamps.startedAt ||
    journeyTimestamps.completedAt ||
    journeyTimestamps.checkedOutAt
  );

  return (
    <>
      {/* Patient Hero */}
      {!detail.isBlock && (
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3.5">
            <PatientAvatar
              size="lg"
              firstName={detail.patientFirstName}
              lastName={detail.patientLastName}
              imageUrl={avatarUrl}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/patients/${detail.patientId}`}
                  className="text-lg font-semibold text-gray-900 hover:text-purple-700 transition-colors truncate"
                >
                  {detail.patientFirstName} {detail.patientLastName}
                </Link>
                {phase && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0",
                      PHASE_CONFIG[phase].bg,
                      PHASE_CONFIG[phase].text
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", PHASE_CONFIG[phase].dot)} />
                    {PHASE_CONFIG[phase].label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                {detail.patientDateOfBirth && (
                  <>
                    <span>{calculateAge(detail.patientDateOfBirth)} yrs</span>
                    <span className="text-gray-300">&middot;</span>
                  </>
                )}
                <span>
                  {detail.patientVisitCount} visit{detail.patientVisitCount !== 1 ? "s" : ""}
                </span>
                <span className="text-gray-300">&middot;</span>
                <span>
                  Since{" "}
                  {new Date(detail.patientCreatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Contact info — vertical stack, full width */}
          {(detail.patientPhone || detail.patientEmail) && (
            <div className="mt-3 space-y-1.5">
              {detail.patientPhone && (
                <a
                  href={`tel:${detail.patientPhone}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <PhoneIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  {formatPhone(detail.patientPhone)}
                </a>
              )}
              {detail.patientEmail && (
                <a
                  href={`mailto:${detail.patientEmail}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <MailIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  {detail.patientEmail}
                </a>
              )}
            </div>
          )}

          {/* Medical alerts — compact inline chips */}
          {(detail.patientAllergies || detail.patientMedicalNotes) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {detail.patientAllergies && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  <AlertTriangleIcon className="h-3 w-3" />
                  {detail.patientAllergies}
                </span>
              )}
              {detail.patientMedicalNotes && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  <ActivityIcon className="h-3 w-3" />
                  {detail.patientMedicalNotes}
                </span>
              )}
            </div>
          )}

        </div>
      )}

      {/* Block header — for time blocks */}
      {detail.isBlock && (
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {detail.blockTitle || "Block"}
          </h2>
        </div>
      )}

      {/* Appointment Card */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 overflow-hidden">
        {/* Service header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              {detail.serviceName ?? (detail.isBlock ? "Blocked Time" : "Appointment")}
            </span>
            {detail.servicePrice != null && (
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                ${detail.servicePrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <CalendarIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-gray-700">
              {new Date(detail.startTime).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {", "}
              {formatTime(detail.startTime)} – {formatTime(detail.endTime)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <ClockIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">
              {formatDuration(detail.startTime, detail.endTime)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <UserIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">{detail.providerName}</span>
          </div>
          {detail.roomName && (
            <div className="flex items-center gap-2.5 text-sm">
              <MapPinIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600">{detail.roomName}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {detail.notes && (
          <div className="px-4 py-2.5 bg-amber-50/50 border-t border-gray-100">
            <p className="text-xs text-gray-600 leading-relaxed">{detail.notes}</p>
          </div>
        )}
      </div>

      {/* Journey Timeline — only when timestamps provided and at least one exists */}
      {hasAnyTimestamp && journeyTimestamps && (
        <div className="mx-5 mb-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">
            Journey
          </h3>
          <div className="space-y-0">
            <TimelineStep
              label="Checked In"
              timestamp={journeyTimestamps.checkedInAt}
              completed={!!journeyTimestamps.checkedInAt}
              active={phase === "here"}
            />
            <TimelineStep
              label="Session Started"
              timestamp={journeyTimestamps.startedAt}
              completed={!!journeyTimestamps.startedAt}
              active={phase === "with_provider"}
            />
            <TimelineStep
              label="Session Completed"
              timestamp={journeyTimestamps.completedAt}
              completed={!!journeyTimestamps.completedAt}
              active={false}
            />
            <TimelineStep
              label="Checked Out"
              timestamp={journeyTimestamps.checkedOutAt}
              completed={!!journeyTimestamps.checkedOutAt}
              active={false}
              isLast
            />
          </div>
        </div>
      )}

      {/* Purchase History — only when non-empty and not a block */}
      {!detail.isBlock && transactions.length > 0 && (
        <div className="mx-5 mb-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">
            Recent Purchases
          </h3>
          <div className="space-y-0.5">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50">
                <div
                  className={cn(
                    "flex-shrink-0 size-7 rounded-full flex items-center justify-center",
                    tx.isService
                      ? "bg-purple-50 text-purple-500"
                      : "bg-gray-100 text-gray-400"
                  )}
                >
                  {tx.isService ? (
                    <SparklesIcon className="h-3.5 w-3.5" />
                  ) : (
                    <TagIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-900 truncate block">
                    {tx.description}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(tx.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  ${tx.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Timeline Step ──────────────────────────────────────────

function TimelineStep({
  label,
  timestamp,
  completed,
  active,
  isLast = false,
}: {
  label: string;
  timestamp: Date | null;
  completed: boolean;
  active: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        {completed ? (
          <CheckCircle2Icon className="h-5 w-5 text-green-500 flex-shrink-0" />
        ) : active ? (
          <CircleDotIcon className="h-5 w-5 text-purple-500 flex-shrink-0" />
        ) : (
          <CircleIcon className="h-5 w-5 text-gray-300 flex-shrink-0" />
        )}
        {!isLast && (
          <div
            className={cn(
              "w-px h-6",
              completed ? "bg-green-300" : "bg-gray-200"
            )}
          />
        )}
      </div>
      <div className={cn("pb-4", isLast && "pb-0")}>
        <p
          className={cn(
            "text-sm font-medium",
            completed ? "text-gray-900" : active ? "text-purple-700" : "text-gray-400"
          )}
        >
          {label}
        </p>
        {timestamp && (
          <p className="text-xs text-gray-500">{formatTimestamp(timestamp)}</p>
        )}
      </div>
    </div>
  );
}
