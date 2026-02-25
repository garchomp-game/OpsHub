import { requireAuth, hasRole } from "@/lib/auth";
import {
    getPendingApprovalsCount,
    getMyWorkflowsCount,
    getMyTasksCount,
    getWeeklyHours,
    getProjectProgress,
    getUnreadNotifications,
} from "./_actions/dashboard";
import DashboardContent from "./_components/DashboardContent";

export default async function DashboardPage() {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    // ─── ロール判定 ──────────────────────────────────
    const isApprover = !!tenantId && hasRole(user, tenantId, ["approver", "tenant_admin"]);
    const isMemberOrPm = !!tenantId && hasRole(user, tenantId, ["member", "pm"]);
    const isPm = !!tenantId && hasRole(user, tenantId, ["pm"]);

    // ─── データ並行取得 ──────────────────────────────
    const [
        pendingApprovals,
        myWorkflows,
        myTasks,
        weeklyHours,
        projectProgress,
        unreadNotifications,
    ] = await Promise.all([
        isApprover ? getPendingApprovalsCount() : Promise.resolve(0),
        getMyWorkflowsCount(),
        isMemberOrPm ? getMyTasksCount() : Promise.resolve(0),
        isMemberOrPm ? getWeeklyHours() : Promise.resolve(0),
        isPm ? getProjectProgress() : Promise.resolve([]),
        getUnreadNotifications(),
    ]);

    return (
        <DashboardContent
            isApprover={isApprover}
            isMemberOrPm={isMemberOrPm}
            isPm={isPm}
            pendingApprovals={pendingApprovals}
            myWorkflows={myWorkflows}
            myTasks={myTasks}
            weeklyHours={weeklyHours}
            projectProgress={projectProgress}
            unreadNotifications={unreadNotifications}
        />
    );
}
