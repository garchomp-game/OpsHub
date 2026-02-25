"use client";

import { useState, useTransition } from "react";
import { Table, Tag, Space, Card, Select, Button, DatePicker, Modal, Dropdown, message, Typography } from "antd";
import type { MenuProps } from "antd";
import { DeleteOutlined, DownOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_STATUS_TRANSITIONS, type InvoiceStatus } from "../_constants";
import { deleteInvoice, updateInvoiceStatus } from "../_actions";
import dayjs from "dayjs";

const { Title } = Typography;

type InvoiceRow = {
    id: string;
    invoice_number: string;
    client_name: string;
    project_id: string | null;
    issued_date: string;
    due_date: string;
    total_amount: number;
    status: string;
    created_at: string;
    projects: { id: string; name: string } | null;
    profiles: { display_name: string } | null;
};

type Project = {
    id: string;
    name: string;
    status: string;
};

type Props = {
    invoices: InvoiceRow[];
    totalCount: number;
    projects: Project[];
    isAdmin: boolean;
    currentFilters: {
        status?: string;
        project_id?: string;
        from?: string;
        to?: string;
    };
};

export default function InvoiceListClient({
    invoices,
    totalCount,
    projects,
    isAdmin,
    currentFilters,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [messageApi, contextHolder] = message.useMessage();

    // フィルタ state
    const [filterStatus, setFilterStatus] = useState<string | undefined>(currentFilters.status);
    const [filterProjectId, setFilterProjectId] = useState<string | undefined>(currentFilters.project_id);
    const [filterFrom, setFilterFrom] = useState<string | undefined>(currentFilters.from);
    const [filterTo, setFilterTo] = useState<string | undefined>(currentFilters.to);

    // フィルタ適用
    const handleFilter = () => {
        const params = new URLSearchParams();
        if (filterStatus) params.set("status", filterStatus);
        if (filterProjectId) params.set("project_id", filterProjectId);
        if (filterFrom) params.set("from", filterFrom);
        if (filterTo) params.set("to", filterTo);
        router.push(`/invoices?${params.toString()}`);
    };

    // 削除
    const handleDelete = (invoiceId: string, invoiceNumber: string) => {
        Modal.confirm({
            title: "請求書を削除",
            content: `${invoiceNumber} を削除してよろしいですか？この操作は取り消せません。`,
            okText: "削除",
            okType: "danger",
            cancelText: "キャンセル",
            onOk: async () => {
                const result = await deleteInvoice({ invoice_id: invoiceId });
                if (result.success) {
                    messageApi.success("請求書を削除しました");
                    startTransition(() => {
                        router.refresh();
                    });
                } else {
                    messageApi.error(result.error.message);
                }
            },
        });
    };

    // ステータス変更
    const handleStatusChange = async (invoiceId: string, newStatus: "sent" | "paid" | "cancelled") => {
        const result = await updateInvoiceStatus({ id: invoiceId, status: newStatus });
        if (result.success) {
            messageApi.success("ステータスを変更しました");
            startTransition(() => {
                router.refresh();
            });
        } else {
            messageApi.error(result.error.message);
        }
    };

    const columns = [
        {
            title: "請求番号",
            dataIndex: "invoice_number",
            key: "invoice_number",
            render: (text: string, record: InvoiceRow) => (
                <Link href={`/invoices/${record.id}`}>{text}</Link>
            ),
        },
        {
            title: "取引先名",
            dataIndex: "client_name",
            key: "client_name",
            ellipsis: true,
        },
        {
            title: "プロジェクト",
            key: "project",
            render: (_: unknown, record: InvoiceRow) => {
                const pj = record.projects;
                return pj ? (
                    <Link href={`/projects/${pj.id}`}>{pj.name}</Link>
                ) : "—";
            },
        },
        {
            title: "発行日",
            dataIndex: "issued_date",
            key: "issued_date",
            render: (d: string) => new Date(d).toLocaleDateString("ja-JP"),
        },
        {
            title: "支払期日",
            dataIndex: "due_date",
            key: "due_date",
            render: (d: string, record: InvoiceRow) => {
                const dueDate = new Date(d);
                const isOverdue = dueDate < new Date()
                    && (record.status === "draft" || record.status === "sent");
                return (
                    <span style={isOverdue ? { color: "#ff4d4f", fontWeight: 600 } : undefined}>
                        {dueDate.toLocaleDateString("ja-JP")}
                    </span>
                );
            },
        },
        {
            title: "金額（税込）",
            dataIndex: "total_amount",
            key: "total_amount",
            align: "right" as const,
            render: (amount: number) => `¥${amount.toLocaleString()}`,
        },
        {
            title: "ステータス",
            dataIndex: "status",
            key: "status",
            render: (status: string) => {
                const s = status as InvoiceStatus;
                return (
                    <Tag color={INVOICE_STATUS_COLORS[s] || "default"}>
                        {INVOICE_STATUS_LABELS[s] || status}
                    </Tag>
                );
            },
        },
        {
            title: "作成者",
            key: "created_by_name",
            render: (_: unknown, record: InvoiceRow) =>
                record.profiles?.display_name || "—",
        },
        {
            title: "操作",
            key: "actions",
            width: 180,
            render: (_: unknown, record: InvoiceRow) => {
                const status = record.status as InvoiceStatus;
                const transitions = INVOICE_STATUS_TRANSITIONS[status] ?? [];

                const statusMenuItems: MenuProps["items"] = transitions.map((t) => ({
                    key: t,
                    label: INVOICE_STATUS_LABELS[t],
                    onClick: () => handleStatusChange(record.id, t as "sent" | "paid" | "cancelled"),
                }));

                return (
                    <Space size="small">
                        <Link href={`/invoices/${record.id}`}>
                            <Button size="small" icon={<EyeOutlined />}>
                                詳細
                            </Button>
                        </Link>
                        {isAdmin && transitions.length > 0 && (
                            <Dropdown menu={{ items: statusMenuItems }} trigger={["click"]}>
                                <Button size="small">
                                    変更 <DownOutlined />
                                </Button>
                            </Dropdown>
                        )}
                        {isAdmin && status === "draft" && (
                            <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete(record.id, record.invoice_number)}
                            />
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div>
            {contextHolder}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>請求一覧</Title>
                {isAdmin && (
                    <Link href="/invoices/new">
                        <Button type="primary" icon={<PlusOutlined />}>
                            新規作成
                        </Button>
                    </Link>
                )}
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Space wrap size="middle">
                    <Select
                        placeholder="ステータス"
                        allowClear
                        style={{ width: 160 }}
                        value={filterStatus}
                        onChange={(v) => setFilterStatus(v)}
                        options={[
                            { value: "", label: "すべて" },
                            { value: "draft", label: "下書き" },
                            { value: "sent", label: "送付済" },
                            { value: "paid", label: "入金済" },
                            { value: "cancelled", label: "キャンセル" },
                        ]}
                    />
                    <Select
                        placeholder="プロジェクト"
                        allowClear
                        style={{ width: 200 }}
                        value={filterProjectId}
                        onChange={(v) => setFilterProjectId(v)}
                        options={projects.map((p) => ({
                            value: p.id,
                            label: p.name,
                        }))}
                    />
                    <DatePicker
                        placeholder="開始日"
                        value={filterFrom ? dayjs(filterFrom) : null}
                        onChange={(d) => setFilterFrom(d ? d.format("YYYY-MM-DD") : undefined)}
                    />
                    <span>〜</span>
                    <DatePicker
                        placeholder="終了日"
                        value={filterTo ? dayjs(filterTo) : null}
                        onChange={(d) => setFilterTo(d ? d.format("YYYY-MM-DD") : undefined)}
                    />
                    <Button type="primary" onClick={handleFilter} loading={isPending}>
                        フィルタ
                    </Button>
                </Space>
            </Card>

            <Card>
                <Table
                    dataSource={invoices}
                    columns={columns}
                    rowKey="id"
                    loading={isPending}
                    pagination={{
                        total: totalCount,
                        pageSize: 20,
                        showTotal: (total) => `全 ${total} 件`,
                    }}
                />
            </Card>
        </div>
    );
}
