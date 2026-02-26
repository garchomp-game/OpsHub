"use client";

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

interface Workflow {
    id: string;
    workflow_number: string;
    type: string;
    title: string;
    amount: number | null;
    created_at: string;
    created_by: string;
}

interface PendingListClientProps {
    workflows: Workflow[];
    count: number;
    profileMap: Record<string, string>;
}

export default function PendingListClient({
    workflows,
    count,
    profileMap,
}: PendingListClientProps) {
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
                {workflows.length === 0 ? (
                    <Empty
                        image={<CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />}
                        description="承認待ちの申請はありません"
                    />
                ) : (
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
                )}
            </Card>
        </div>
    );
}
