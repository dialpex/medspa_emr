import { getBoardEntries, getClinicUsers, getCurrentUserId } from "@/lib/actions/board";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac-core";
import { BoardWidgetClient } from "./board-widget-client";

export async function BoardWidget() {
  const user = await requireAuth();
  const canWrite = hasPermission(user.role, "board", "create");

  const [entries, users, currentUserId] = await Promise.all([
    getBoardEntries(),
    getClinicUsers(),
    getCurrentUserId(),
  ]);

  return (
    <BoardWidgetClient
      entries={entries}
      users={users}
      currentUserId={currentUserId}
      canWrite={canWrite}
    />
  );
}
