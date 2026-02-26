"use client";

import Link from "next/link";
import { Table, Button, Tag, Space, Card, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Title } = Typography;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "下書き", color: "default" },
    submitted: { label: "申請中", color: "processing" },
    approved: { label: "承認済", color: "success" },
    rejected: { label: "差戻し", color: "error" },
    withdrawn: { label: "取下げ", color: "warning" },
};

const TYPE_LABELS: Record<string, string> = {
    expense: "経費",
    leave: "休暇",
    purchase: "購入",
    other: "その他",
};

interface Workflow {
    id: string;
    workflow_number: string;
    type: string;
    title: string;
    status: string;
    amount: number | null;
    created_at: string;
}

interface WorkflowListClientProps {
    workflows: Workflow[];
    count: number;
    currentStatus?: string;
}

export default function WorkflowListClient({
    workflows,
    count,
    currentStatus,
}: WorkflowListClientProps) {
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
            title: "ステータス",
            dataIndex: "status",
            key: "status",
            render: (status: string) => {
                const s = STATUS_LABELS[status] || { label: status, color: "default" };
                return <Tag color={s.color}>{s.label}</Tag>;
            },
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
    ];

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>ワークフロー申請</Title>
                <Link href="/workflows/new">
                    <Button type="primary" icon={<PlusOutlined />}>
                        新規申請
                    </Button>
                </Link>
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <form action="/workflows" method="GET">
                        <Space>
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
                                <option value="draft">下書き</option>
                                <option value="submitted">申請中</option>
                                <option value="approved">承認済</option>
                                <option value="rejected">差戻し</option>
                                <option value="withdrawn">取下げ</option>
                            </select>
                            <Button htmlType="submit" type="primary">フィルタ</Button>
                        </Space>
                    </form>
                </Space>
            </Card>

            <Card>
                <Table
                    dataSource={workflows}
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
