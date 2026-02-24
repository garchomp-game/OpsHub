import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth";
import Link from "next/link";
import { Table, Button, Tag, Space, Card, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Title } = Typography;

const CATEGORY_COLORS: Record<string, string> = {
    "交通費": "blue",
    "宿泊費": "purple",
    "会議費": "cyan",
    "消耗品費": "orange",
    "通信費": "green",
    "その他": "default",
};

const WF_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "下書き", color: "default" },
    submitted: { label: "申請中", color: "processing" },
    approved: { label: "承認済", color: "success" },
    rejected: { label: "差戻し", color: "error" },
    withdrawn: { label: "取下げ", color: "warning" },
};

export default async function ExpensesPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>;
}) {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];
    const params = await searchParams;

    // Accounting / Tenant Admin は全件、それ以外は自分のみ
    const isAdmin = hasRole(user, tenantId, ["accounting", "tenant_admin"]);

    let query = supabase
        .from("expenses")
        .select(`
            *,
            projects ( id, name ),
            workflows ( id, status, workflow_number ),
            profiles!expenses_created_by_fkey ( display_name )
        `, { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (!isAdmin) {
        query = query.eq("created_by", user.id);
    }

    if (params.category) {
        query = query.eq("category", params.category);
    }

    const { data: expenses, count } = await query;

    const columns = [
        {
            title: "申請番号",
            key: "workflow_number",
            render: (_: unknown, record: Record<string, unknown>) => {
                const wf = record.workflows as { id: string; workflow_number: string } | null;
                return wf ? (
                    <Link href={`/workflows/${wf.id}`}>{wf.workflow_number}</Link>
                ) : "—";
            },
        },
        {
            title: "カテゴリ",
            dataIndex: "category",
            key: "category",
            render: (cat: string) => (
                <Tag color={CATEGORY_COLORS[cat] || "default"}>{cat}</Tag>
            ),
        },
        {
            title: "金額",
            dataIndex: "amount",
            key: "amount",
            render: (amount: number) => `¥${amount.toLocaleString()}`,
        },
        {
            title: "日付",
            dataIndex: "expense_date",
            key: "expense_date",
            render: (d: string) => new Date(d).toLocaleDateString("ja-JP"),
        },
        {
            title: "プロジェクト",
            key: "project",
            render: (_: unknown, record: Record<string, unknown>) => {
                const pj = record.projects as { id: string; name: string } | null;
                return pj ? (
                    <Link href={`/projects/${pj.id}`}>{pj.name}</Link>
                ) : "—";
            },
        },
        {
            title: "ステータス",
            key: "status",
            render: (_: unknown, record: Record<string, unknown>) => {
                const wf = record.workflows as { status: string } | null;
                if (!wf) return "—";
                const s = WF_STATUS_LABELS[wf.status] || { label: wf.status, color: "default" };
                return <Tag color={s.color}>{s.label}</Tag>;
            },
        },
        {
            title: "説明",
            dataIndex: "description",
            key: "description",
            ellipsis: true,
            render: (desc: string | null) => desc || "—",
        },
        {
            title: "申請日",
            dataIndex: "created_at",
            key: "created_at",
            render: (d: string) => new Date(d).toLocaleDateString("ja-JP"),
        },
        {
            title: "申請者",
            key: "created_by_name",
            render: (_: unknown, record: Record<string, unknown>) => {
                const profile = record.profiles as { display_name: string } | null;
                return profile?.display_name || "—";
            },
        },
    ];

    const currentCategory = params.category || undefined;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>経費管理</Title>
                <Link href="/expenses/new">
                    <Button type="primary" icon={<PlusOutlined />}>
                        経費申請
                    </Button>
                </Link>
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <form action="/expenses" method="GET">
                        <Space>
                            <select
                                name="category"
                                defaultValue={currentCategory || ""}
                                style={{
                                    height: 32,
                                    borderRadius: 6,
                                    border: "1px solid #d9d9d9",
                                    padding: "0 8px",
                                }}
                            >
                                <option value="">すべてのカテゴリ</option>
                                <option value="交通費">交通費</option>
                                <option value="宿泊費">宿泊費</option>
                                <option value="会議費">会議費</option>
                                <option value="消耗品費">消耗品費</option>
                                <option value="通信費">通信費</option>
                                <option value="その他">その他</option>
                            </select>
                            <Button htmlType="submit" type="primary">フィルタ</Button>
                        </Space>
                    </form>
                </Space>
            </Card>

            <Card>
                <Table
                    dataSource={expenses ?? []}
                    columns={columns}
                    rowKey="id"
                    pagination={{
                        total: count ?? 0,
                        pageSize: 20,
                        showTotal: (total) => `全 ${total} 件`,
                    }}
                />
            </Card>
        </div>
    );
}
