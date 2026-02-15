import { Suspense } from "react";
import { requirePermission } from "@/lib/rbac";
import {
  getAppointments,
  getProviders,
  getRooms,
  getResources,
  getServices,
  getAppointmentPermissions,
} from "@/lib/actions/appointments";
import { CalendarFilters } from "./calendar-filters";
import { CalendarView } from "./calendar-view";
import { CalendarSkeleton } from "./loading";
import { PageCard } from "@/components/ui/page-card";

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
  await requirePermission("appointments", "view");

  const params = await searchParams;
  const dateParam = params.date;
  const currentDate = dateParam ? new Date(dateParam) : new Date();
  const view = (params.view === "day" ? "day" : "week") as "day" | "week";
  const filters = {
    providerId: params.providerId,
    roomId: params.roomId,
  };

  let startDate: Date;
  let endDate: Date;

  if (view === "day") {
    startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(currentDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      <PageCard title="Calendar">
        <Suspense fallback={<CalendarSkeleton />}>
          <CalendarContent
            startDate={startDate}
            endDate={endDate}
            currentDate={currentDate}
            view={view}
            filters={filters}
          />
        </Suspense>
      </PageCard>
    </div>
  );
}

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
  const [appointments, providers, rooms, resources, services, permissions] = await Promise.all([
    getAppointments(startDate, endDate, filters),
    getProviders(),
    getRooms(),
    getResources(),
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
        resources={resources}
        services={services}
        currentDate={currentDate.toISOString()}
        view={view}
        permissions={permissions}
      />
    </>
  );
}
