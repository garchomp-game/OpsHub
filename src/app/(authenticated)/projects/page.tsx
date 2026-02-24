import { requireAuth, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Table, Button, Tag, Space, Input, Select, Typography, Card } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ProjectStatus } from "@/types";

const { Title } = Typography;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    planning: { label: "計画中", color: "blue" },
    active: { label: "進行中", color: "green" },
    completed: { label: "完了", color: "default" },
    cancelled: { label: "中止", color: "red" },
};

export default async function ProjectsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; search?: string }>;
}) {
    const user = await requireAuth();
    const supabase = await createClient();
    const tenantId = user.tenantIds[0];
    const params = await searchParams;

    let query = supabase
        .from("projects")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (params.status) {
        query = query.eq("status", params.status);
    }
    if (params.search) {
        query = query.ilike("name", `%${params.search}%`);
    }

    const { data: projects, count } = await query;

    // メンバー数とタスク統計を取得
    const projectIds = (projects ?? []).map((p) => p.id);
    const { data: memberCounts } = await supabase
        .from("project_members")
        .select("project_id")
        .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"]);

    const memberCountMap: Record<string, number> = {};
    (memberCounts ?? []).forEach((m) => {
        memberCountMap[m.project_id] = (memberCountMap[m.project_id] || 0) + 1;
    });

    const canCreate = hasRole(user, tenantId, ["pm", "tenant_admin"]);

    const columns = [
        {
            title: "プロジェクト名",
            dataIndex: "name",
            key: "name",
            render: (name: string, record: { id: string }) => (
                <Link href={`/projects/${record.id}`}>{name}</Link>
            ),
        },
        {
            title: "ステータス",
            dataIndex: "status",
            key: "status",
            render: (status: string) => {
                const s = STATUS_LABELS[status] || { label: status, color: "default" };
                return <Tag color={s.color}>{s.label}</Tag>;
            },
        },
        {
            title: "メンバー数",
            key: "members",
            render: (_: unknown, record: { id: string }) => memberCountMap[record.id] || 0,
        },
        {
            title: "開始日",
            dataIndex: "start_date",
            key: "start_date",
            render: (d: string | null) => d || "—",
        },
        {
            title: "終了日",
            dataIndex: "end_date",
            key: "end_date",
            render: (d: string | null) => d || "—",
        },
        {
            title: "作成日",
            dataIndex: "created_at",
            key: "created_at",
            render: (d: string) => new Date(d).toLocaleDateString("ja-JP"),
        },
    ];

    const currentStatus = params.status || undefined;
    const currentSearch = params.search || undefined;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>プロジェクト</Title>
                {canCreate && (
                    <Link href="/projects/new">
                        <Button type="primary" icon={<PlusOutlined />}>
                            新規プロジェクト
                        </Button>
                    </Link>
                )}
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <form action="/projects" method="GET">
                        <Space>
                            <Input
                                name="search"
                                placeholder="プロジェクト名で検索"
                                prefix={<SearchOutlined />}
                                defaultValue={currentSearch}
                                allowClear
                                style={{ width: 240 }}
                            />
                            <select
                                name="status"
                                defaultValue={currentStatus || ""}
                                style={{
                                    height: 32,
                                    borderRadius: 6,
                                    border: "1px solid #d9d9d9",
                                    padding: "0 8px",
                                }}
                            >
                                <option value="">すべてのステータス</option>
                                <option value="planning">計画中</option>
                                <option value="active">進行中</option>
                                <option value="completed">完了</option>
                                <option value="cancelled">中止</option>
                            </select>
                            <Button htmlType="submit" type="primary">フィルタ</Button>
                        </Space>
                    </form>
                </Space>
            </Card>

            <Card>
                <Table
                    dataSource={projects ?? []}
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
