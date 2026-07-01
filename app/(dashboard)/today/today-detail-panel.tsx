"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  Loader2Icon,
  FileTextIcon,
  CreditCardIcon,
  CalendarPlusIcon,
} from "lucide-react";
import {
  getAppointmentWithPatient,
  updateAppointmentStatus,
  getPatientTransactionHistory,
  type AppointmentDetail,
  type PatientTransaction,
} from "@/lib/actions/appointments";
import {
  confirmAppointment,
  checkInAppointment,
  markNoShow,
  beginService,
  getAppointmentTimestamps,
  type TodayPermissions,
} from "@/lib/actions/today";
import { createChart, getCharts } from "@/lib/actions/charts";
import { createInvoiceFromAppointmentAction, getCheckoutDataAction } from "@/lib/actions/checkout";
import { derivePhase } from "@/lib/today-utils";
import { AppointmentPanelContent } from "@/components/appointment-panel-content";
import { CheckoutDrawer } from "@/app/(dashboard)/checkout/checkout-drawer";
import { CheckoutContent } from "@/app/(dashboard)/checkout/checkout-content";
import type { CheckoutData } from "@/lib/services/checkout-shared";
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
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);

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

  /** Move to Completed then open checkout drawer */
  const handleCheckOut = useCallback(
    (apptId: string) => {
      startTransition(async () => {
        await updateAppointmentStatus(apptId, "Completed");
        const invoiceResult = await createInvoiceFromAppointmentAction(apptId);
        if (!invoiceResult.success) return;
        const data = await getCheckoutDataAction(invoiceResult.invoiceId);
        setCheckoutData(data);
        await refreshDetail();
      });
    },
    [refreshDetail]
  );

  const handleCloseCheckout = useCallback(() => {
    setCheckoutData(null);
    refreshDetail();
  }, [refreshDetail]);

  /** Navigate to chart — find existing or create new */
  const handleOpenChart = useCallback(async () => {
    if (!detail) return;
    const existing = await getCharts({ patientId: detail.patientId ?? undefined });
    const existingChart = existing.find((c) => c.appointmentId === detail.id);
    if (existingChart) {
      router.push(
        existingChart.status === "Draft"
          ? `/charts/${existingChart.id}/edit`
          : `/charts/${existingChart.id}`
      );
      return;
    }
    router.push(`/charts/new?patientId=${detail.patientId}&appointmentId=${detail.id}`);
  }, [detail, router]);

  /** Reschedule — navigate to calendar with patient pre-filled */
  const handleReschedule = useCallback(() => {
    if (!detail) return;
    router.push(
      `/calendar?reschedulePatientId=${detail.patientId}&reschedulePatientName=${encodeURIComponent(
        `${detail.patientFirstName} ${detail.patientLastName}`
      )}&rescheduleProviderId=${detail.providerId || ""}`
    );
    onClose();
  }, [detail, router, onClose]);

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
                {/* Scheduled: Confirm, Check In, Cancel */}
                {detail.status === "Scheduled" && (
                  <>
                    {permissions.canConfirm && (
                      <button
                        onClick={() => handleAction(confirmAppointment)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
                      >
                        {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                        Confirm
                      </button>
                    )}
                    <div className="flex gap-2">
                      {permissions.canCheckIn && (
                        <button
                          onClick={() => handleAction(checkInAppointment)}
                          disabled={isPending}
                          className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                          Check In
                        </button>
                      )}
                      {permissions.canEdit && (
                        <button
                          onClick={() => handleAction((id) => updateAppointmentStatus(id, "Cancelled"))}
                          disabled={isPending}
                          className="py-2.5 px-4 text-sm font-medium text-red-600 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 border border-red-200 shadow-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Confirmed: Check In, No Show, Cancel */}
                {detail.status === "Confirmed" && (
                  <>
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
                    <div className="flex gap-2">
                      {permissions.canCheckIn && (
                        <button
                          onClick={() => handleAction(markNoShow)}
                          disabled={isPending}
                          className="flex-1 py-2.5 px-4 text-sm font-medium text-orange-600 bg-white rounded-lg hover:bg-orange-50 disabled:opacity-50 border border-orange-200 shadow-sm"
                        >
                          No Show
                        </button>
                      )}
                      {permissions.canEdit && (
                        <button
                          onClick={() => handleAction((id) => updateAppointmentStatus(id, "Cancelled"))}
                          disabled={isPending}
                          className="py-2.5 px-4 text-sm font-medium text-red-600 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 border border-red-200 shadow-sm"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* CheckedIn: Begin Service (provider only), Check Out (all) */}
                {detail.status === "CheckedIn" && (
                  <>
                    {permissions.isProvider && permissions.canBeginService && (
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
                    {permissions.canCheckOut && (
                      <button
                        onClick={() => handleCheckOut(detail.id)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isPending ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCardIcon className="h-4 w-4" />
                        )}
                        Check Out
                      </button>
                    )}
                  </>
                )}

                {/* InProgress: Chart (provider only), Check Out (all) */}
                {detail.status === "InProgress" && (
                  <>
                    {permissions.isProvider && permissions.canOpenChart && (
                      <button
                        onClick={handleOpenChart}
                        className="w-full py-2.5 px-4 text-sm font-medium text-purple-700 bg-white rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 border border-purple-200 shadow-sm"
                      >
                        <FileTextIcon className="h-4 w-4" />
                        Chart
                      </button>
                    )}
                    {permissions.canCheckOut && (
                      <button
                        onClick={() => handleCheckOut(detail.id)}
                        disabled={isPending}
                        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isPending ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCardIcon className="h-4 w-4" />
                        )}
                        Check Out
                      </button>
                    )}
                  </>
                )}

                {/* Completed: Open Chart (provider only) */}
                {detail.status === "Completed" && permissions.isProvider && permissions.canOpenChart && (
                  <button
                    onClick={handleOpenChart}
                    className="w-full py-2.5 px-4 text-sm font-medium text-purple-700 bg-white rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 border border-purple-200 shadow-sm"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Open Chart
                  </button>
                )}

                {/* Cancelled / NoShow: Reschedule */}
                {(detail.status === "Cancelled" || detail.status === "NoShow") && (
                  <button
                    onClick={handleReschedule}
                    className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
                  >
                    <CalendarPlusIcon className="h-4 w-4" />
                    Reschedule
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Drawer */}
      <CheckoutDrawer open={!!checkoutData} onClose={handleCloseCheckout}>
        {checkoutData && (
          <CheckoutContent initialData={checkoutData} onClose={handleCloseCheckout} />
        )}
      </CheckoutDrawer>
    </>
  );
}
