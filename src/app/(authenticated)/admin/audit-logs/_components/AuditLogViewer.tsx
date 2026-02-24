"use client";

import { useState, useCallback, useTransition } from "react";
import {
    Table,
    Card,
    Select,
    DatePicker,
    Space,
    Tag,
    Typography,
    Row,
    Col,
    Button,
} from "antd";
import { FilterOutlined, ClearOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Tables } from "@/types/database";
import type { Json } from "@/types/database";
import type { Dayjs } from "dayjs";
import {
    fetchAuditLogs,
    type FetchAuditLogsResult,
    type FilterOptions,
} from "../_actions";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type AuditLogRow = Tables<"audit_logs">;

interface AuditLogViewerProps {
    initialData: FetchAuditLogsResult;
    filterOptions: FilterOptions;
    defaultPageSize: number;
}

// アクション種別の表示ラベルとカラー
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    "workflow.create": { label: "申請作成", color: "blue" },
    "workflow.submit": { label: "申請送信", color: "cyan" },
    "workflow.approve": { label: "申請承認", color: "green" },
    "workflow.reject": { label: "申請差戻し", color: "red" },
    "workflow.withdraw": { label: "申請取下げ", color: "orange" },
    "project.create": { label: "PJ作成", color: "blue" },
    "project.update": { label: "PJ更新", color: "geekblue" },
    "project.delete": { label: "PJ削除", color: "red" },
    "project.add_member": { label: "メンバー追加", color: "green" },
    "project.remove_member": { label: "メンバー削除", color: "orange" },
    "task.create": { label: "タスク作成", color: "blue" },
    "task.update": { label: "タスク更新", color: "geekblue" },
    "task.delete": { label: "タスク削除", color: "red" },
    "task.status_change": { label: "ステータス変更", color: "purple" },
    "user.invite": { label: "ユーザー招待", color: "blue" },
    "user.role_change": { label: "ロール変更", color: "purple" },
    "user.activate": { label: "ユーザー有効化", color: "green" },
    "user.deactivate": { label: "ユーザー無効化", color: "red" },
    "tenant.update": { label: "テナント更新", color: "geekblue" },
    "tenant.delete": { label: "テナント削除", color: "red" },
    "timesheet.create": { label: "工数作成", color: "blue" },
    "timesheet.update": { label: "工数更新", color: "geekblue" },
    "timesheet.delete": { label: "工数削除", color: "red" },
};

// リソース種別の表示ラベル
const RESOURCE_TYPE_LABELS: Record<string, string> = {
    workflow: "ワークフロー",
    project: "プロジェクト",
    task: "タスク",
    user: "ユーザー",
    tenant: "テナント",
    timesheet: "工数",
    expense: "経費",
};

/**
 * JSON データの差分を見やすく表示するコンポーネント
 */
function JsonDiff({
    before,
    after,
}: {
    before: Json | null;
    after: Json | null;
}) {
    if (!before && !after) {
        return <Text type="secondary">変更データなし</Text>;
    }

    const beforeObj =
        before && typeof before === "object" && !Array.isArray(before)
            ? (before as Record<string, Json | undefined>)
            : null;
    const afterObj =
        after && typeof after === "object" && !Array.isArray(after)
            ? (after as Record<string, Json | undefined>)
            : null;

    // キーの合集
    const allKeys = new Set([
        ...Object.keys(beforeObj ?? {}),
        ...Object.keys(afterObj ?? {}),
    ]);

    // 変更のあったキーだけ抽出
    const changedKeys = [...allKeys].filter((key) => {
        const bVal = JSON.stringify(beforeObj?.[key] ?? null);
        const aVal = JSON.stringify(afterObj?.[key] ?? null);
        return bVal !== aVal;
    });

    if (changedKeys.length === 0 && beforeObj && afterObj) {
        return <Text type="secondary">変更なし</Text>;
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                background: "#fafafa",
                borderRadius: 8,
                padding: 16,
            }}
        >
            <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                    変更前
                </Text>
                {before ? (
                    <pre
                        style={{
                            fontSize: 12,
                            background: "#fff1f0",
                            padding: 12,
                            borderRadius: 6,
                            maxHeight: 300,
                            overflow: "auto",
                            margin: 0,
                            border: "1px solid #ffccc7",
                        }}
                    >
                        {JSON.stringify(
                            beforeObj
                                ? Object.fromEntries(
                                    changedKeys.map((k) => [
                                        k,
                                        beforeObj[k],
                                    ])
                                )
                                : before,
                            null,
                            2
                        )}
                    </pre>
                ) : (
                    <Text type="secondary" italic>
                        （なし — 新規作成）
                    </Text>
                )}
            </div>
            <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                    変更後
                </Text>
                {after ? (
                    <pre
                        style={{
                            fontSize: 12,
                            background: "#f6ffed",
                            padding: 12,
                            borderRadius: 6,
                            maxHeight: 300,
                            overflow: "auto",
                            margin: 0,
                            border: "1px solid #b7eb8f",
                        }}
                    >
                        {JSON.stringify(
                            afterObj
                                ? Object.fromEntries(
                                    changedKeys.map((k) => [k, afterObj[k]])
                                )
                                : after,
                            null,
                            2
                        )}
                    </pre>
                ) : (
                    <Text type="secondary" italic>
                        （なし — 削除）
                    </Text>
                )}
            </div>
        </div>
    );
}

export default function AuditLogViewer({
    initialData,
    filterOptions,
    defaultPageSize,
}: AuditLogViewerProps) {
    // ─── データ State ───────────────────────────────
    const [logs, setLogs] = useState<AuditLogRow[]>(initialData.logs);
    const [total, setTotal] = useState(initialData.total);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const [isPending, startTransition] = useTransition();

    // ─── フィルタ State ─────────────────────────────
    const [dateRange, setDateRange] = useState<
        [Dayjs | null, Dayjs | null] | null
    >(null);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [selectedResource, setSelectedResource] = useState<string | null>(
        null
    );

    // ─── サーバーからデータ取得 ─────────────────────
    const loadData = useCallback(
        (
            targetPage: number,
            targetPageSize: number,
            filters?: {
                dateRange?: [Dayjs | null, Dayjs | null] | null;
                userId?: string | null;
                action?: string | null;
                resourceType?: string | null;
            }
        ) => {
            const dr = filters?.dateRange ?? dateRange;
            const uid = filters?.userId ?? selectedUser;
            const act = filters?.action ?? selectedAction;
            const res = filters?.resourceType ?? selectedResource;

            startTransition(async () => {
                const result = await fetchAuditLogs({
                    page: targetPage,
                    pageSize: targetPageSize,
                    dateFrom:
                        dr && dr[0]
                            ? dr[0].format("YYYY-MM-DD")
                            : undefined,
                    dateTo:
                        dr && dr[1]
                            ? dr[1].format("YYYY-MM-DD")
                            : undefined,
                    userId: uid ?? undefined,
                    action: act ?? undefined,
                    resourceType: res ?? undefined,
                });
                setLogs(result.logs);
                setTotal(result.total);
            });
        },
        [dateRange, selectedUser, selectedAction, selectedResource]
    );

    // ─── フィルタ変更ハンドラ ───────────────────────
    const handleDateRangeChange = (
        val: [Dayjs | null, Dayjs | null] | null
    ) => {
        setDateRange(val);
        setPage(1);
        loadData(1, pageSize, { dateRange: val });
    };

    const handleUserChange = (val: string | null) => {
        setSelectedUser(val);
        setPage(1);
        loadData(1, pageSize, { userId: val });
    };

    const handleActionChange = (val: string | null) => {
        setSelectedAction(val);
        setPage(1);
        loadData(1, pageSize, { action: val });
    };

    const handleResourceChange = (val: string | null) => {
        setSelectedResource(val);
        setPage(1);
        loadData(1, pageSize, { resourceType: val });
    };

    const clearFilters = () => {
        setDateRange(null);
        setSelectedUser(null);
        setSelectedAction(null);
        setSelectedResource(null);
        setPage(1);
        loadData(1, pageSize, {
            dateRange: null,
            userId: null,
            action: null,
            resourceType: null,
        });
    };

    const hasFilterActive =
        dateRange || selectedUser || selectedAction || selectedResource;

    // ─── ページネーション変更 ───────────────────────
    const handleTableChange = (newPage: number, newPageSize: number) => {
        setPage(newPage);
        setPageSize(newPageSize);
        loadData(newPage, newPageSize);
    };

    const columns: ColumnsType<AuditLogRow> = [
        {
            title: "日時",
            dataIndex: "created_at",
            key: "created_at",
            width: 180,
            render: (val: string) =>
                new Date(val).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                }),
        },
        {
            title: "操作者",
            dataIndex: "user_id",
            key: "user_id",
            width: 200,
            ellipsis: true,
            render: (val: string) => {
                const userInfo = filterOptions.userIds.find((u) => u.id === val);
                return (
                    <Text copyable={{ text: val }} style={{ fontSize: 12 }}>
                        {userInfo?.displayName ?? val.substring(0, 8) + "…"}
                    </Text>
                );
            },
        },
        {
            title: "アクション",
            dataIndex: "action",
            key: "action",
            width: 160,
            render: (val: string) => {
                const info = ACTION_LABELS[val];
                return info ? (
                    <Tag color={info.color}>{info.label}</Tag>
                ) : (
                    <Tag>{val}</Tag>
                );
            },
        },
        {
            title: "リソース種別",
            dataIndex: "resource_type",
            key: "resource_type",
            width: 140,
            render: (val: string) =>
                RESOURCE_TYPE_LABELS[val] ?? val,
        },
        {
            title: "リソースID",
            dataIndex: "resource_id",
            key: "resource_id",
            width: 200,
            ellipsis: true,
            render: (val: string | null) =>
                val ? (
                    <Text
                        copyable={{ text: val }}
                        style={{ fontSize: 12 }}
                    >
                        {val.substring(0, 8)}…
                    </Text>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
    ];

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                監査ログ
            </Title>

            {/* フィルタ */}
            <Card
                size="small"
                style={{ marginBottom: 16 }}
                title={
                    <Space>
                        <FilterOutlined />
                        <span>フィルタ</span>
                    </Space>
                }
                extra={
                    hasFilterActive && (
                        <Button
                            type="link"
                            size="small"
                            icon={<ClearOutlined />}
                            onClick={clearFilters}
                        >
                            クリア
                        </Button>
                    )
                }
            >
                <Row gutter={[16, 12]}>
                    <Col xs={24} sm={12} md={6}>
                        <Text
                            type="secondary"
                            style={{
                                display: "block",
                                marginBottom: 4,
                                fontSize: 12,
                            }}
                        >
                            期間
                        </Text>
                        <RangePicker
                            style={{ width: "100%" }}
                            value={dateRange}
                            onChange={(val) => handleDateRangeChange(val)}
                            placeholder={["開始日", "終了日"]}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Text
                            type="secondary"
                            style={{
                                display: "block",
                                marginBottom: 4,
                                fontSize: 12,
                            }}
                        >
                            ユーザー
                        </Text>
                        <Select
                            allowClear
                            placeholder="すべてのユーザー"
                            style={{ width: "100%" }}
                            value={selectedUser}
                            onChange={handleUserChange}
                            options={filterOptions.userIds.map((u) => ({
                                label: u.displayName,
                                value: u.id,
                            }))}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Text
                            type="secondary"
                            style={{
                                display: "block",
                                marginBottom: 4,
                                fontSize: 12,
                            }}
                        >
                            アクション種別
                        </Text>
                        <Select
                            allowClear
                            placeholder="すべてのアクション"
                            style={{ width: "100%" }}
                            value={selectedAction}
                            onChange={handleActionChange}
                            options={filterOptions.actionTypes.map((a) => ({
                                label:
                                    ACTION_LABELS[a]?.label ?? a,
                                value: a,
                            }))}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Text
                            type="secondary"
                            style={{
                                display: "block",
                                marginBottom: 4,
                                fontSize: 12,
                            }}
                        >
                            リソース種別
                        </Text>
                        <Select
                            allowClear
                            placeholder="すべてのリソース"
                            style={{ width: "100%" }}
                            value={selectedResource}
                            onChange={handleResourceChange}
                            options={filterOptions.resourceTypes.map((r) => ({
                                label:
                                    RESOURCE_TYPE_LABELS[r] ?? r,
                                value: r,
                            }))}
                        />
                    </Col>
                </Row>
            </Card>

            {/* テーブル */}
            <Card>
                <Table
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    size="middle"
                    loading={isPending}
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50", "100"],
                        showTotal: (t) => `全 ${t} 件`,
                        onChange: handleTableChange,
                    }}
                    expandable={{
                        expandedRowRender: (record) => (
                            <div style={{ padding: "8px 0" }}>
                                <JsonDiff
                                    before={record.before_data}
                                    after={record.after_data}
                                />
                                {record.metadata &&
                                    typeof record.metadata === "object" &&
                                    Object.keys(record.metadata).length > 0 && (
                                        <div style={{ marginTop: 12 }}>
                                            <Text
                                                strong
                                                style={{
                                                    display: "block",
                                                    marginBottom: 4,
                                                }}
                                            >
                                                メタデータ
                                            </Text>
                                            <pre
                                                style={{
                                                    fontSize: 12,
                                                    background: "#f5f5f5",
                                                    padding: 12,
                                                    borderRadius: 6,
                                                    margin: 0,
                                                }}
                                            >
                                                {JSON.stringify(
                                                    record.metadata,
                                                    null,
                                                    2
                                                )}
                                            </pre>
                                        </div>
                                    )}
                            </div>
                        ),
                        rowExpandable: (record) =>
                            !!(record.before_data || record.after_data || record.metadata),
                    }}
                    locale={{ emptyText: "該当する監査ログはありません" }}
                />
            </Card>
        </div>
    );
}
