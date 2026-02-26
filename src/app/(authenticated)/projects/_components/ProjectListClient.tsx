"use client";

import Link from "next/link";
import { Table, Button, Tag, Space, Input, Typography, Card } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";

const { Title } = Typography;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    planning: { label: "計画中", color: "blue" },
    active: { label: "進行中", color: "green" },
    completed: { label: "完了", color: "default" },
    cancelled: { label: "中止", color: "red" },
};

interface Project {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

interface ProjectListClientProps {
    projects: Project[];
    count: number;
    memberCountMap: Record<string, number>;
    canCreate: boolean;
    currentStatus?: string;
    currentSearch?: string;
}

export default function ProjectListClient({
    projects,
    count,
    memberCountMap,
    canCreate,
    currentStatus,
    currentSearch,
}: ProjectListClientProps) {
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
                    dataSource={projects}
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
