"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  Loader2Icon,
  FileTextIcon,
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
  markNoShow,
  beginService,
  completeSession,
  checkOutAppointment,
  getAppointmentTimestamps,
  type TodayPermissions,
} from "@/lib/actions/today";
import { derivePhase } from "@/lib/today-utils";
import { AppointmentPanelContent } from "@/components/appointment-panel-content";
import { cn } from "@/lib/utils";

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
          if (data.patientId) {
            getPatientTransactionHistory(data.patientId)
              .then(setTransactions)
              .catch(() => setTransactions([]));
          }
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
              ) : detail && phase ? (
                <AppointmentPanelContent
                  detail={detail}
                  transactions={transactions}
                  phase={phase}
                  journeyTimestamps={{
                    checkedInAt: detail.checkedInAt,
                    startedAt: detail.startedAt,
                    completedAt: detail.completedAt,
                    checkedOutAt: detail.checkedOutAt,
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                  Appointment not found
                </div>
              )}
            </div>

            {/* Actions Footer */}
            {detail && phase && (
              <div className="border-t bg-gray-50/50 p-4 space-y-2">
                {phase === "upcoming" && (
                  <>
                    {permissions.canConfirm && detail.status === "Scheduled" && (
                      <button
                        onClick={() => handleAction(confirmAppointment)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
                      >
                        {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                        Confirm
                      </button>
                    )}
                    {permissions.canCheckIn && (
                      <button
                        onClick={() => handleAction(checkInAppointment)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                        Check In
                      </button>
                    )}
                    {permissions.canCheckIn && new Date() > new Date(detail.startTime) && (
                      <button
                        onClick={() => handleAction(markNoShow)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-medium text-red-600 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2 border border-red-200 shadow-sm"
                      >
                        {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                        Mark No Show
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
                    className="w-full py-2.5 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    Begin Service
                  </button>
                )}
                {phase === "with_provider" && permissions.canCompleteSession && (
                  <button
                    onClick={() => handleAction(completeSession)}
                    disabled={isPending}
                    className="w-full py-2.5 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    Complete Session
                  </button>
                )}
                {phase === "done" && permissions.canCheckOut && !detail.checkedOutAt && (
                  <button
                    onClick={() => handleAction(checkOutAppointment)}
                    disabled={isPending}
                    className="w-full py-2.5 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                    Check Out
                  </button>
                )}

                {/* Chart button */}
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
                      className="w-full py-2.5 px-4 text-sm font-medium text-purple-700 bg-white rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 border border-purple-200 shadow-sm"
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
