import { Suspense } from "react";
import { requirePermission } from "@/lib/rbac";
import {
  getProviders,
  getRooms,
} from "@/lib/actions/appointments";
import {
  getTodayAppointments,
  getTodayPermissions,
  getClinicTimezone,
  type JourneyPhase,
} from "@/lib/actions/today";
import { TodayFilters } from "./today-filters";
import { TodayList } from "./today-list";
import { TodaySkeleton } from "./loading";

type SearchParams = Promise<{
  providerId?: string;
  roomId?: string;
  phase?: string;
  search?: string;
  density?: string;
}>;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("appointments", "view");

  const params = await searchParams;

  const filters = {
    providerId: params.providerId,
    roomId: params.roomId,
    phase: params.phase as JourneyPhase | undefined,
    search: params.search,
  };

  const density = (params.density === "compact" ? "compact" : "comfortable") as
    | "compact"
    | "comfortable";

  return (
    <div className="p-6 max-w-full mx-auto">
      <Suspense fallback={<TodaySkeleton />}>
        <TodayContent filters={filters} density={density} />
      </Suspense>
    </div>
  );
}

async function TodayContent({
  filters,
  density,
}: {
  filters: {
    providerId?: string;
    roomId?: string;
    phase?: JourneyPhase;
    search?: string;
  };
  density: "compact" | "comfortable";
}) {
  const [appointments, allAppointments, permissions, timezone, providers, rooms] =
    await Promise.all([
      getTodayAppointments(filters),
      // Fetch all (without phase filter) for tab counts
      getTodayAppointments({
        providerId: filters.providerId,
        roomId: filters.roomId,
        search: filters.search,
      }),
      getTodayPermissions(),
      getClinicTimezone(),
      getProviders(),
      getRooms(),
    ]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {dateStr} &middot; {timezone} &middot;{" "}
            {allAppointments.length} appointment{allAppointments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Two-column layout: appointments left, dashboard cards right */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column: filters + appointment list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Appointments</p>
            <h3 className="text-lg font-semibold text-gray-900 mt-1">Today&apos;s Schedule</h3>
          </div>
          <div className="mb-4">
            <TodayFilters
              providers={providers}
              rooms={rooms}
              appointments={allAppointments}
            />
          </div>
          <TodayList
            appointments={appointments}
            permissions={permissions}
            density={density}
          />
        </div>

        {/* Right column: dashboard widgets */}
        <div className="hidden xl:flex flex-col gap-5">
          {/* Two widgets side by side */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-h-[340px] flex flex-col">
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Widget 1</p>
                <h3 className="text-lg font-semibold text-gray-900 mt-1">Coming Soon</h3>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-gray-300">Content placeholder</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-h-[340px] flex flex-col">
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Widget 2</p>
                <h3 className="text-lg font-semibold text-gray-900 mt-1">Coming Soon</h3>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-gray-300">Content placeholder</span>
              </div>
            </div>
          </div>
          {/* One full-width widget below */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-h-[200px] flex flex-col">
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Widget 3</p>
              <h3 className="text-lg font-semibold text-gray-900 mt-1">Coming Soon</h3>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm text-gray-300">Content placeholder</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
