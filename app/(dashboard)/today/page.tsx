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

      {/* Filters */}
      <div className="mb-4">
        <TodayFilters
          providers={providers}
          rooms={rooms}
          appointments={allAppointments}
        />
      </div>

      {/* List */}
      <TodayList
        appointments={appointments}
        permissions={permissions}
        density={density}
      />
    </>
  );
}
