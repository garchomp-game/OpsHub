"use client";

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

interface Expense {
    id: string;
    category: string;
    amount: number;
    expense_date: string;
    description: string | null;
    created_at: string;
    projects: { id: string; name: string } | null;
    workflows: { id: string; status: string; workflow_number: string } | null;
    profiles: { display_name: string } | null;
}

interface ExpenseListClientProps {
    expenses: Expense[];
    count: number;
    currentCategory?: string;
}

export default function ExpenseListClient({
    expenses,
    count,
    currentCategory,
}: ExpenseListClientProps) {
    const columns = [
        {
            title: "申請番号",
            key: "workflow_number",
            render: (_: unknown, record: Expense) => {
                const wf = record.workflows;
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
            render: (_: unknown, record: Expense) => {
                const pj = record.projects;
                return pj ? (
                    <Link href={`/projects/${pj.id}`}>{pj.name}</Link>
                ) : "—";
            },
        },
        {
            title: "ステータス",
            key: "status",
            render: (_: unknown, record: Expense) => {
                const wf = record.workflows;
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
            render: (_: unknown, record: Expense) => {
                return record.profiles?.display_name || "—";
            },
        },
    ];

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
                    dataSource={expenses}
                    columns={columns}
                    rowKey="id"
                    pagination={{
                        total: count,
                        pageSize: 20,
                        showTotal: (total) => `全 ${total} 件`,
                    }}
                />
            </Card>
        </div>
    );
}
