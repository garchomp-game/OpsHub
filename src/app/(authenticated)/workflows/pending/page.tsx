import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Table, Tag, Card, Typography, Empty } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";

const { Title } = Typography;

const TYPE_LABELS: Record<string, string> = {
    expense: "経費",
    leave: "休暇",
    purchase: "購入",
    other: "その他",
};

export default async function PendingWorkflowsPage() {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];

    // Approver / Tenant Admin のみアクセス可
    if (!hasRole(user, tenantId, ["approver", "tenant_admin"])) {
        redirect("/workflows");
    }

    const isTenantAdmin = hasRole(user, tenantId, ["tenant_admin"]);

    let query = supabase
        .from("workflows")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });

    if (!isTenantAdmin) {
        query = query.eq("approver_id", user.id);
    }

    const { data: workflows, count } = await query;

    // 申請者の表示名を取得
    const creatorIds = [...new Set((workflows ?? []).map((w) => w.created_by))];
    const { data: profilesData } = creatorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", creatorIds)
        : { data: [] };

    const profileMap: Record<string, string> = {};
    for (const p of profilesData ?? []) {
        profileMap[p.id] = p.display_name;
    }

    const columns = [
        {
            title: "申請番号",
            dataIndex: "workflow_number",
            key: "workflow_number",
            render: (num: string, record: { id: string }) => (
                <Link href={`/workflows/${record.id}`}>{num}</Link>
            ),
        },
        {
            title: "種別",
            dataIndex: "type",
            key: "type",
            render: (type: string) => TYPE_LABELS[type] || type,
        },
        {
            title: "タイトル",
            dataIndex: "title",
            key: "title",
            render: (title: string, record: { id: string }) => (
                <Link href={`/workflows/${record.id}`}>{title}</Link>
            ),
        },
        {
            title: "申請者",
            dataIndex: "created_by",
            key: "created_by",
            render: (id: string) => profileMap[id] ?? id,
        },
        {
            title: "金額",
            dataIndex: "amount",
            key: "amount",
            render: (amount: number | null) =>
                amount != null ? `¥${amount.toLocaleString()}` : "—",
        },
        {
            title: "申請日",
            dataIndex: "created_at",
            key: "created_at",
            render: (d: string) => new Date(d).toLocaleDateString("ja-JP"),
        },
        {
            title: "ステータス",
            key: "status",
            render: () => <Tag color="processing">承認待ち</Tag>,
        },
    ];

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>承認待ち一覧</Title>
            </div>

            <Card>
                {(workflows ?? []).length === 0 ? (
                    <Empty
                        image={<CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />}
                        description="承認待ちの申請はありません"
                    />
                ) : (
                    <Table
                        dataSource={workflows ?? []}
                        columns={columns}
                        rowKey="id"
                        pagination={{
                            total: count ?? 0,
                            pageSize: 20,
                            showTotal: (total) => `全 ${total} 件`,
                        }}
                    />
                )}
            </Card>
        </div>
    );
}
