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
  EditIcon,
  Loader2Icon,
  FileTextIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import {
  getAppointmentWithPatient,
  updateAppointmentStatus,
  getPatientTransactionHistory,
  type AppointmentDetail,
  type CalendarAppointment,
  type PatientTransaction,
  type Provider,
  type Room,
  type ResourceOption,
  type Service,
} from "@/lib/actions/appointments";
import { PatientAvatar } from "@/components/patient-avatar";
import { StatusBadge, STATUS_LABELS } from "./appointment-card";
import { AppointmentForm } from "./appointment-form";
import { createChart, getCharts } from "@/lib/actions/charts";

// Next logical status transitions
const NEXT_STATUS: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string }>> = {
  Scheduled: { status: "Confirmed", label: "Mark as Confirmed" },
  Confirmed: { status: "CheckedIn", label: "Check In" },
  CheckedIn: { status: "InProgress", label: "Start" },
  InProgress: { status: "Completed", label: "Complete" },
};

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

export type AppointmentPanelProps = {
  appointmentId: string | null;
  onClose: () => void;
  providers: Provider[];
  rooms: Room[];
  resources: ResourceOption[];
  services: Service[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
};

export function AppointmentPanel({
  appointmentId,
  onClose,
  providers,
  rooms,
  resources,
  services,
  permissions,
}: AppointmentPanelProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [transactions, setTransactions] = useState<PatientTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editFormOpen, setEditFormOpen] = useState(false);

  const isOpen = !!appointmentId;

  // Fetch appointment detail and transaction history
  useEffect(() => {
    if (!appointmentId) {
      setDetail(null);
      setTransactions([]);
      return;
    }
    setLoading(true);
    getAppointmentWithPatient(appointmentId)
      .then((data) => {
        setDetail(data);
        if (data) {
          getPatientTransactionHistory(data.patientId)
            .then(setTransactions)
            .catch(() => setTransactions([]));
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  const handleStatusChange = useCallback(
    (newStatus: AppointmentStatus) => {
      if (!detail) return;
      startTransition(async () => {
        const result = await updateAppointmentStatus(detail.id, newStatus);
        if (result.success) {
          // Refresh detail
          const updated = await getAppointmentWithPatient(detail.id);
          setDetail(updated);
          router.refresh();
        }
      });
    },
    [detail, router]
  );

  // Build a CalendarAppointment for the edit form
  const calendarAppointment: CalendarAppointment | undefined = detail
    ? {
        id: detail.id,
        patientId: detail.patientId,
        patientName: `${detail.patientFirstName} ${detail.patientLastName}`,
        providerId: "", // not available in detail, form will use provider name lookup
        providerName: detail.providerName,
        serviceId: null,
        serviceName: detail.serviceName,
        roomId: null,
        roomName: detail.roomName,
        resourceId: null,
        resourceName: null,
        startTime: detail.startTime,
        endTime: detail.endTime,
        status: detail.status,
        notes: detail.notes,
      }
    : undefined;

  const nextStatus = detail ? NEXT_STATUS[detail.status] : undefined;

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
        className={`fixed top-0 right-0 z-50 h-full w-[400px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
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
                    <div className="mt-1">
                      <StatusBadge status={detail.status} />
                    </div>
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
                      {/* Avatar */}
                      <PatientAvatar size="md" firstName={detail.patientFirstName} lastName={detail.patientLastName} />
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
                            {formatDate(detail.patientDateOfBirth)} ({calculateAge(detail.patientDateOfBirth)} yrs)
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                          Client since{" "}
                          {new Date(detail.patientCreatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {detail.patientVisitCount} visit{detail.patientVisitCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    {/* Allergies */}
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
                          <div
                            key={tx.id}
                            className="flex items-center gap-3 py-1.5"
                          >
                            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                              tx.isService
                                ? "bg-purple-50 text-purple-500"
                                : "bg-gray-100 text-gray-500"
                            }`}>
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
            {detail && (
              <div className="border-t p-4 space-y-2">
                {/* Status transition */}
                {nextStatus && permissions.canEdit && (
                  <button
                    onClick={() => handleStatusChange(nextStatus.status)}
                    disabled={isPending}
                    className="w-full py-2 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    {nextStatus.label}
                  </button>
                )}

                {/* Start Chart button */}
                {permissions.canEdit &&
                  (detail.status === "InProgress" || detail.status === "Completed") && (
                    <button
                      onClick={async () => {
                        // Check if a chart already exists for this appointment
                        const existing = await getCharts({ patientId: detail.patientId });
                        const existingChart = existing.find(
                          (c) => c.appointmentId === detail.id
                        );
                        if (existingChart) {
                          router.push(
                            existingChart.status === "Draft"
                              ? `/charts/${existingChart.id}/edit`
                              : `/charts/${existingChart.id}`
                          );
                          return;
                        }
                        const result = await createChart({
                          patientId: detail.patientId,
                          appointmentId: detail.id,
                        });
                        if (result.success && result.data) {
                          router.push(`/charts/${result.data.id}/edit`);
                        }
                      }}
                      className="w-full py-2 px-4 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-2 border border-purple-200"
                    >
                      <FileTextIcon className="h-4 w-4" />
                      Start Chart
                    </button>
                  )}

                <div className="flex gap-2">
                  {permissions.canEdit && (
                    <button
                      onClick={() => setEditFormOpen(true)}
                      className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                    >
                      <EditIcon className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                  {permissions.canEdit && detail.status !== "Cancelled" && (
                    <button
                      onClick={() => handleStatusChange("Cancelled")}
                      disabled={isPending}
                      className="py-2 px-4 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                  {permissions.canEdit && detail.status !== "NoShow" && (
                    <button
                      onClick={() => handleStatusChange("NoShow")}
                      disabled={isPending}
                      className="py-2 px-4 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50"
                    >
                      No Show
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Form Modal (on top of panel) */}
      {calendarAppointment && (
        <AppointmentForm
          isOpen={editFormOpen}
          onClose={() => {
            setEditFormOpen(false);
            // Refresh panel data
            if (appointmentId) {
              getAppointmentWithPatient(appointmentId).then(setDetail);
            }
            router.refresh();
          }}
          providers={providers}
          rooms={rooms}
          resources={resources}
          services={services}
          permissions={permissions}
          appointment={calendarAppointment}
        />
      )}
    </>
  );
}
