"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  XIcon,
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  AlertTriangleIcon,
  Loader2Icon,
  FileTextIcon,
  SparklesIcon,
  TagIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
} from "lucide-react";
import {
  getAppointmentWithPatient,
  getPatientTransactionHistory,
  type AppointmentDetail,
  type PatientTransaction,
} from "@/lib/actions/appointments";
import {
  confirmAppointment,
  checkInAppointment,
  beginService,
  completeSession,
  checkOutAppointment,
  getAppointmentTimestamps,
  type TodayPermissions,
} from "@/lib/actions/today";
import { derivePhase } from "@/lib/today-utils";
import { cn } from "@/lib/utils";

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

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

type DetailWithTimestamps = AppointmentDetail & {
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  checkedOutAt: Date | null;
};

export function TodayDetailPanel({
  appointmentId,
  onClose,
  permissions,
}: {
  appointmentId: string | null;
  onClose: () => void;
  permissions: TodayPermissions;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<DetailWithTimestamps | null>(null);
  const [transactions, setTransactions] = useState<PatientTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isOpen = !!appointmentId;

  useEffect(() => {
    if (!appointmentId) {
      setDetail(null);
      setTransactions([]);
      return;
    }
    setLoading(true);

    Promise.all([
      getAppointmentWithPatient(appointmentId),
      getAppointmentTimestamps(appointmentId),
    ])
      .then(([data, timestamps]) => {
        if (data) {
          setDetail({ ...data, ...timestamps });
          getPatientTransactionHistory(data.patientId)
            .then(setTransactions)
            .catch(() => setTransactions([]));
        } else {
          setDetail(null);
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  const refreshDetail = useCallback(async () => {
    if (!appointmentId) return;
    const [data, timestamps] = await Promise.all([
      getAppointmentWithPatient(appointmentId),
      getAppointmentTimestamps(appointmentId),
    ]);
    if (data) {
      setDetail({ ...data, ...timestamps });
    }
    router.refresh();
  }, [appointmentId, router]);

  const handleAction = useCallback(
    (actionFn: (id: string) => Promise<{ success: boolean; error?: string }>) => {
      if (!detail) return;
      startTransition(async () => {
        const result = await actionFn(detail.id);
        if (result.success) {
          await refreshDetail();
        }
      });
    },
    [detail, refreshDetail]
  );

  const phase = detail
    ? derivePhase({
        status: detail.status,
        checkedInAt: detail.checkedInAt,
        startedAt: detail.startedAt,
        completedAt: detail.completedAt,
      })
    : null;

  const PHASE_CONFIG = {
    upcoming: { label: "Upcoming", bg: "bg-blue-50", text: "text-blue-700" },
    here: { label: "Here", bg: "bg-yellow-50", text: "text-yellow-700" },
    with_provider: { label: "With Provider", bg: "bg-purple-50", text: "text-purple-700" },
    done: { label: "Done", bg: "bg-green-50", text: "text-green-700" },
    no_show: { label: "No Show", bg: "bg-red-50", text: "text-red-700" },
    cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[400px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b">
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
                ) : detail ? (
                  <>
                    <Link
                      href={`/patients/${detail.patientId}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {detail.patientFirstName} {detail.patientLastName}
                    </Link>
                    {phase && (
                      <div className="mt-1">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            PHASE_CONFIG[phase].bg,
                            PHASE_CONFIG[phase].text
                          )}
                        >
                          {PHASE_CONFIG[phase].label}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">Not found</span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors ml-2"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2Icon className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : detail ? (
                <div className="divide-y">
                  {/* Patient Info */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Patient Info
                    </h3>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
                        {detail.patientFirstName[0]}
                        {detail.patientLastName[0]}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {detail.patientPhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
                            {formatPhone(detail.patientPhone)}
                          </div>
                        )}
                        {detail.patientEmail && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MailIcon className="h-3.5 w-3.5 text-gray-400" />
                            <span className="truncate">{detail.patientEmail}</span>
                          </div>
                        )}
                        {detail.patientDateOfBirth && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                            {formatDate(detail.patientDateOfBirth)} (
                            {calculateAge(detail.patientDateOfBirth)} yrs)
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                          Client since{" "}
                          {new Date(detail.patientCreatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                          {" \u00B7 "}
                          {detail.patientVisitCount} visit
                          {detail.patientVisitCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    {detail.patientAllergies && (
                      <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                        <AlertTriangleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold text-red-700">Allergies</span>
                          <p className="text-sm text-red-600">{detail.patientAllergies}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Appointment Details */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Appointment Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-900">
                          {formatDate(detail.startTime)}, {formatTime(detail.startTime)} -{" "}
                          {formatTime(detail.endTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-600">
                          {formatDuration(detail.startTime, detail.endTime)}
                        </span>
                      </div>
                      {detail.serviceName && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-900">{detail.serviceName}</span>
                          {detail.servicePrice != null && (
                            <span className="text-gray-600">
                              ${detail.servicePrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-600">{detail.providerName}</span>
                      </div>
                      {detail.roomName && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPinIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-600">{detail.roomName}</span>
                        </div>
                      )}
                      {detail.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                          <span className="text-xs font-medium text-gray-500">Notes</span>
                          <p className="text-sm text-gray-700 mt-0.5">{detail.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Journey Timeline */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Journey Timeline
                    </h3>
                    <div className="space-y-0">
                      <TimelineStep
                        label="Checked In"
                        timestamp={detail.checkedInAt}
                        completed={!!detail.checkedInAt}
                        active={phase === "here"}
                      />
                      <TimelineStep
                        label="Session Started"
                        timestamp={detail.startedAt}
                        completed={!!detail.startedAt}
                        active={phase === "with_provider"}
                      />
                      <TimelineStep
                        label="Session Completed"
                        timestamp={detail.completedAt}
                        completed={!!detail.completedAt}
                        active={false}
                      />
                      <TimelineStep
                        label="Checked Out"
                        timestamp={detail.checkedOutAt}
                        completed={!!detail.checkedOutAt}
                        active={false}
                        isLast
                      />
                    </div>
                  </div>

                  {/* Purchase History */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Purchase History
                    </h3>
                    {transactions.length === 0 ? (
                      <p className="text-sm text-gray-400">No purchase history</p>
                    ) : (
                      <div className="space-y-1">
                        {transactions.map((tx) => (
                          <div key={tx.id} className="flex items-center gap-3 py-1.5">
                            <div
                              className={cn(
                                "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                                tx.isService
                                  ? "bg-purple-50 text-purple-500"
                                  : "bg-gray-100 text-gray-500"
                              )}
                            >
                              {tx.isService ? (
                                <SparklesIcon className="h-3.5 w-3.5" />
                              ) : (
                                <TagIcon className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span className="flex-1 text-sm text-gray-900 truncate">
                              {tx.description}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-sm font-medium text-gray-900 tabular-nums w-16 text-right">
                              ${tx.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Actions Footer */}
            {detail && phase && (
              <div className="border-t p-4 space-y-2">
                {/* Phase-specific actions */}
                {phase === "upcoming" && (
                  <>
                    {permissions.canConfirm && detail.status === "Scheduled" && (
                      <button
                        onClick={() => handleAction(confirmAppointment)}
                        disabled={isPending}
                        className="w-full py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                        Confirm
                      </button>
                    )}
                    {permissions.canCheckIn && (
                      <button
                        onClick={() => handleAction(checkInAppointment)}
                        disabled={isPending}
                        className="w-full py-2 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                        Check In
                      </button>
                    )}
                  </>
                )}
                {phase === "here" && permissions.canBeginService && (
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        const result = await beginService(detail.id);
                        if (result.success && result.data) {
                          router.push(`/charts/${result.data.chartId}/edit`);
                        } else {
                          await refreshDetail();
                        }
                      });
                    }}
                    disabled={isPending}
                    className="w-full py-2 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    Begin Service
                  </button>
                )}
                {phase === "with_provider" && permissions.canCompleteSession && (
                  <button
                    onClick={() => handleAction(completeSession)}
                    disabled={isPending}
                    className="w-full py-2 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    Complete Session
                  </button>
                )}
                {phase === "done" && permissions.canCheckOut && !detail.checkedOutAt && (
                  <button
                    onClick={() => handleAction(checkOutAppointment)}
                    disabled={isPending}
                    className="w-full py-2 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    Check Out
                  </button>
                )}

                {/* Chart button — shown when chart exists */}
                {permissions.canOpenChart &&
                  detail.hasChart &&
                  detail.chartId &&
                  (phase === "with_provider" || phase === "done") && (
                    <button
                      onClick={() => {
                        router.push(
                          detail.chartStatus === "Draft"
                            ? `/charts/${detail.chartId}/edit`
                            : `/charts/${detail.chartId}`
                        );
                      }}
                      className="w-full py-2 px-4 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-2 border border-purple-200"
                    >
                      <FileTextIcon className="h-4 w-4" />
                      Open Chart
                    </button>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

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

