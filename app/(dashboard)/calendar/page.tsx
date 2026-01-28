import { Suspense } from "react";
import { requirePermission } from "@/lib/rbac";
import {
  getAppointments,
  getProviders,
  getRooms,
  getServices,
  getAppointmentPermissions,
} from "@/lib/actions/appointments";
import { CalendarFilters } from "./calendar-filters";
import { CalendarView } from "./calendar-view";
import { CalendarSkeleton } from "./loading";

type SearchParams = Promise<{
  date?: string;
  view?: string;
  providerId?: string;
  roomId?: string;
}>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Check permission
  await requirePermission("appointments", "view");

  // Await search params
  const params = await searchParams;

  // Parse date from URL or use today
  const dateParam = params.date;
  const currentDate = dateParam ? new Date(dateParam) : new Date();

  // Parse view from URL or default to week
  const view = (params.view === "day" ? "day" : "week") as "day" | "week";

  // Parse filters
  const filters = {
    providerId: params.providerId,
    roomId: params.roomId,
  };

  // Calculate date range based on view
  let startDate: Date;
  let endDate: Date;

  if (view === "day") {
    startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(currentDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Week view - get start and end of week
    startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Sunday
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // Saturday
    endDate.setHours(23, 59, 59, 999);
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
      </div>

      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarContent
          startDate={startDate}
          endDate={endDate}
          currentDate={currentDate}
          view={view}
          filters={filters}
        />
      </Suspense>
    </div>
  );
}

// Separate async component for data fetching
async function CalendarContent({
  startDate,
  endDate,
  currentDate,
  view,
  filters,
}: {
  startDate: Date;
  endDate: Date;
  currentDate: Date;
  view: "day" | "week";
  filters: { providerId?: string; roomId?: string };
}) {
  // Parallel data fetching
  const [appointments, providers, rooms, services, permissions] = await Promise.all([
    getAppointments(startDate, endDate, filters),
    getProviders(),
    getRooms(),
    getServices(),
    getAppointmentPermissions(),
  ]);

  return (
    <>
      <CalendarFilters
        providers={providers}
        rooms={rooms}
        currentDate={currentDate.toISOString()}
        view={view}
      />
      <CalendarView
        appointments={appointments}
        providers={providers}
        rooms={rooms}
        services={services}
        currentDate={currentDate.toISOString()}
        view={view}
        permissions={permissions}
      />
    </>
  );
}
