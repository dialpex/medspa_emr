"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  EditIcon,
  Loader2Icon,
  FileTextIcon,
} from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import {
  getAppointmentWithPatient,
  updateAppointmentStatus,
  deleteAppointment,
  deleteRecurringAppointment,
  getPatientTransactionHistory,
  type AppointmentDetail,
  type CalendarAppointment,
  type PatientTransaction,
  type Provider,
  type Room,
  type ResourceOption,
  type Service,
} from "@/lib/actions/appointments";
import { createChart, getCharts } from "@/lib/actions/charts";
import { AppointmentPanelContent } from "@/components/appointment-panel-content";
import { AppointmentForm } from "./appointment-form";
import { cn } from "@/lib/utils";

// Next logical status transitions
const NEXT_STATUS: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string }>> = {
  Scheduled: { status: "Confirmed", label: "Mark as Confirmed" },
  Confirmed: { status: "CheckedIn", label: "Check In" },
  CheckedIn: { status: "InProgress", label: "Start" },
  InProgress: { status: "Completed", label: "Complete" },
};

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
  const [deleteConfirm, setDeleteConfirm] = useState<null | "prompt" | "scope">(null);

  const isOpen = !!appointmentId;

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
        if (data && data.patientId) {
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
          const updated = await getAppointmentWithPatient(detail.id);
          setDetail(updated);
          router.refresh();
        }
      });
    },
    [detail, router]
  );

  const handleDelete = useCallback(
    (scope?: "this" | "thisAndFuture" | "all") => {
      if (!detail) return;
      startTransition(async () => {
        if (detail.recurrenceGroupId && scope) {
          await deleteRecurringAppointment(detail.id, scope);
        } else {
          await deleteAppointment(detail.id);
        }
        setDeleteConfirm(null);
        onClose();
        router.refresh();
      });
    },
    [detail, onClose, router]
  );

  const calendarAppointment: CalendarAppointment | undefined = detail
    ? {
        id: detail.id,
        patientId: detail.patientId,
        patientName: `${detail.patientFirstName} ${detail.patientLastName}`,
        providerId: "",
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
        recurrenceGroupId: detail.recurrenceGroupId,
        isBlock: detail.isBlock,
        blockTitle: detail.blockTitle,
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
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[400px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <XIcon className="h-4 w-4 text-gray-500" />
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2Icon className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : detail ? (
                <AppointmentPanelContent
                  detail={detail}
                  transactions={transactions}
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                  Appointment not found
                </div>
              )}
            </div>

            {/* Actions Footer */}
            {detail && (
              <div className="border-t bg-gray-50/50 p-4 space-y-2">
                {detail.isBlock ? (
                  /* Block time: only Edit and Delete */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {permissions.canEdit && (
                        <button
                          onClick={() => setEditFormOpen(true)}
                          className="flex-1 py-2.5 px-4 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
                        >
                          <EditIcon className="h-4 w-4" />
                          Edit
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => {
                            if (detail.recurrenceGroupId) {
                              setDeleteConfirm("scope");
                            } else {
                              setDeleteConfirm("prompt");
                            }
                          }}
                          disabled={isPending}
                          className="py-2.5 px-4 text-sm font-medium text-red-600 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 border border-red-200 shadow-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Delete confirmation */}
                    {deleteConfirm === "prompt" && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
                        <p className="text-sm text-red-700 font-medium">Delete this block?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete()}
                            disabled={isPending}
                            className="flex-1 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {isPending ? "Deleting..." : "Yes, Delete"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="flex-1 py-1.5 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Recurring scope picker */}
                    {deleteConfirm === "scope" && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
                        <p className="text-sm text-red-700 font-medium">Delete recurring block</p>
                        <div className="space-y-1.5">
                          <button
                            onClick={() => handleDelete("this")}
                            disabled={isPending}
                            className="w-full py-1.5 text-sm font-medium text-red-700 bg-white rounded-lg border border-red-200 hover:bg-red-100 disabled:opacity-50 text-left px-3"
                          >
                            This event only
                          </button>
                          <button
                            onClick={() => handleDelete("thisAndFuture")}
                            disabled={isPending}
                            className="w-full py-1.5 text-sm font-medium text-red-700 bg-white rounded-lg border border-red-200 hover:bg-red-100 disabled:opacity-50 text-left px-3"
                          >
                            This and future events
                          </button>
                          <button
                            onClick={() => handleDelete("all")}
                            disabled={isPending}
                            className="w-full py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 text-left px-3"
                          >
                            All events in series
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="w-full py-1.5 text-sm font-medium text-gray-600 text-left px-3 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Regular appointment: full actions */
                  <>
                    {/* Status transition */}
                    {nextStatus && permissions.canEdit && (
                      <button
                        onClick={() => handleStatusChange(nextStatus.status)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
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
                            const existing = await getCharts({ patientId: detail.patientId ?? undefined });
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
                              patientId: detail.patientId!,
                              appointmentId: detail.id,
                            });
                            if (result.success && result.data) {
                              router.push(`/charts/${result.data.id}/edit`);
                            }
                          }}
                          className="w-full py-2.5 px-4 text-sm font-medium text-purple-700 bg-white rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 border border-purple-200 shadow-sm"
                        >
                          <FileTextIcon className="h-4 w-4" />
                          Start Chart
                        </button>
                      )}

                    <div className="flex gap-2">
                      {permissions.canEdit && (
                        <button
                          onClick={() => setEditFormOpen(true)}
                          className="flex-1 py-2.5 px-4 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
                        >
                          <EditIcon className="h-4 w-4" />
                          Edit
                        </button>
                      )}
                      {permissions.canEdit && detail.status !== "Cancelled" && (
                        <button
                          onClick={() => handleStatusChange("Cancelled")}
                          disabled={isPending}
                          className="py-2.5 px-4 text-sm font-medium text-red-600 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 border border-red-200 shadow-sm"
                        >
                          Cancel
                        </button>
                      )}
                      {permissions.canEdit && detail.status !== "NoShow" && (
                        <button
                          onClick={() => handleStatusChange("NoShow")}
                          disabled={isPending}
                          className="py-2.5 px-4 text-sm font-medium text-orange-600 bg-white rounded-lg hover:bg-orange-50 disabled:opacity-50 border border-orange-200 shadow-sm"
                        >
                          No Show
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Form Modal */}
      {calendarAppointment && (
        <AppointmentForm
          isOpen={editFormOpen}
          onClose={() => {
            setEditFormOpen(false);
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
