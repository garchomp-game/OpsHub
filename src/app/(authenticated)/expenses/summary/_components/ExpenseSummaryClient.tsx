"use client";

import { useState, useTransition } from "react";
import {
    Typography,
    Card,
    Button,
    Space,
    Select,
    DatePicker,
    Table,
    Tabs,
    Tag,
    Statistic,
    Row,
    Col,
    Progress,
    message,
    Empty,
} from "antd";
import {
    SearchOutlined,
    BarChartOutlined,
    DollarOutlined,
} from "@ant-design/icons";
import {
    getExpenseSummaryByCategory,
    getExpenseSummaryByProject,
    getExpenseSummaryByMonth,
    getExpenseStats,
    type ExpenseSummaryFilters,
    type CategorySummary,
    type ProjectSummary,
    type MonthlySummary,
    type ExpenseStats,
} from "../_actions";
import type { ActionResult } from "@/types";

const { Title, Text } = Typography;

// ─── カテゴリ色定義（SCR-D01 と統一） ───────────────

const CATEGORY_COLORS: Record<string, string> = {
    "交通費": "blue",
    "宿泊費": "purple",
    "会議費": "cyan",
    "消耗品費": "orange",
    "通信費": "green",
    "その他": "default",
};

const CATEGORY_OPTIONS = [
    { value: "交通費", label: "交通費" },
    { value: "宿泊費", label: "宿泊費" },
    { value: "会議費", label: "会議費" },
    { value: "消耗品費", label: "消耗品費" },
    { value: "通信費", label: "通信費" },
    { value: "その他", label: "その他" },
];

const PROGRESS_COLORS = ["#1677ff", "#722ed1", "#13c2c2", "#fa8c16", "#52c41a", "#d9d9d9"];

// ─── Types ──────────────────────────────────────────

type Project = { id: string; name: string };

type Props = {
    filters: ExpenseSummaryFilters;
    byCategory: ActionResult<CategorySummary[]>;
    byProject: ActionResult<ProjectSummary[]>;
    byMonth: ActionResult<MonthlySummary[]>;
    stats: ActionResult<ExpenseStats>;
    projects: Project[];
};

// ─── Component ──────────────────────────────────────

export default function ExpenseSummaryClient({
    filters: initialFilters,
    byCategory: initialByCategory,
    byProject: initialByProject,
    byMonth: initialByMonth,
    stats: initialStats,
    projects,
}: Props) {
    const [isPending, startTransition] = useTransition();

    // フィルタ状態
    const [dateFrom, setDateFrom] = useState(initialFilters.date_from);
    const [dateTo, setDateTo] = useState(initialFilters.date_to);
    const [category, setCategory] = useState<string | undefined>(initialFilters.category);
    const [projectId, setProjectId] = useState<string | undefined>(initialFilters.project_id);
    const [approvedOnly, setApprovedOnly] = useState(initialFilters.approved_only ?? false);

    // データ
    const [byCategory, setByCategory] = useState(initialByCategory);
    const [byProject, setByProject] = useState(initialByProject);
    const [byMonth, setByMonth] = useState(initialByMonth);
    const [stats, setStats] = useState(initialStats);

    const handleSearch = () => {
        if (dateFrom > dateTo) {
            message.error("開始日は終了日以前を指定してください");
            return;
        }

        const filters: ExpenseSummaryFilters = {
            date_from: dateFrom,
            date_to: dateTo,
            category,
            project_id: projectId,
            approved_only: approvedOnly,
        };

        startTransition(async () => {
            const [catResult, projResult, monthResult, statsResult] = await Promise.all([
                getExpenseSummaryByCategory(filters),
                getExpenseSummaryByProject(filters),
                getExpenseSummaryByMonth(filters),
                getExpenseStats(filters),
            ]);

            setByCategory(catResult);
            setByProject(projResult);
            setByMonth(monthResult);
            setStats(statsResult);
        });
    };

    // Safe data extraction
    const categoryData = byCategory.success ? byCategory.data : [];
    const projectData = byProject.success ? byProject.data : [];
    const monthData = byMonth.success ? byMonth.data : [];
    const statsData = stats.success
        ? stats.data
        : { total_amount: 0, total_count: 0, avg_amount: 0, max_amount: 0 };

    const hasError = !byCategory.success || !byProject.success || !byMonth.success || !stats.success;

    // ─── カテゴリ別テーブル定義 ──────────────────────

    const categoryColumns = [
        {
            title: "カテゴリ",
            dataIndex: "category",
            key: "category",
            render: (cat: string) => (
                <Tag color={CATEGORY_COLORS[cat] || "default"}>{cat}</Tag>
            ),
        },
        { title: "件数", dataIndex: "count", key: "count", align: "right" as const },
        {
            title: "合計金額",
            dataIndex: "total_amount",
            key: "total_amount",
            align: "right" as const,
            render: (v: number) => `¥${v.toLocaleString()}`,
        },
        {
            title: "割合",
            dataIndex: "percentage",
            key: "percentage",
            align: "right" as const,
            render: (v: number) => `${v.toFixed(1)}%`,
        },
    ];

    const categoryTotal = categoryData.reduce((s, c) => s + c.total_amount, 0);
    const categoryCountTotal = categoryData.reduce((s, c) => s + c.count, 0);

    // ─── PJ別テーブル定義 ───────────────────────────

    const projectColumns = [
        { title: "プロジェクト", dataIndex: "name", key: "name" },
        { title: "件数", dataIndex: "count", key: "count", align: "right" as const },
        {
            title: "合計金額",
            dataIndex: "total_amount",
            key: "total_amount",
            align: "right" as const,
            render: (v: number) => `¥${v.toLocaleString()}`,
        },
    ];

    const projectTotal = projectData.reduce((s, p) => s + p.total_amount, 0);
    const projectCountTotal = projectData.reduce((s, p) => s + p.count, 0);

    // ─── 月別テーブル定義 ───────────────────────────

    const monthColumns = [
        {
            title: "月",
            dataIndex: "month",
            key: "month",
            render: (m: string) => {
                const [y, mo] = m.split("-");
                return `${y}年${mo}月`;
            },
        },
        { title: "件数", dataIndex: "count", key: "count", align: "right" as const },
        {
            title: "合計金額",
            dataIndex: "total_amount",
            key: "total_amount",
            align: "right" as const,
            render: (v: number) => `¥${v.toLocaleString()}`,
        },
    ];

    const monthTotal = monthData.reduce((s, m) => s + m.total_amount, 0);
    const monthCountTotal = monthData.reduce((s, m) => s + m.count, 0);

    // ─── Render ─────────────────────────────────────

    return (
        <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    経費集計
                </Title>
            </div>

            {/* フィルタ Card */}
            <Card style={{ marginBottom: 16 }}>
                <Space wrap size="middle">
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>期間（From）</Text>
                        <DatePicker
                            onChange={(_, dateString) => {
                                if (typeof dateString === "string" && dateString) setDateFrom(dateString);
                            }}
                            style={{ width: 160 }}
                            placeholder="開始日"
                        />
                    </div>
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>期間（To）</Text>
                        <DatePicker
                            onChange={(_, dateString) => {
                                if (typeof dateString === "string" && dateString) setDateTo(dateString);
                            }}
                            style={{ width: 160 }}
                            placeholder="終了日"
                        />
                    </div>
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>カテゴリ</Text>
                        <Select
                            placeholder="全て"
                            allowClear
                            value={category}
                            onChange={setCategory}
                            options={CATEGORY_OPTIONS}
                            style={{ width: 160 }}
                        />
                    </div>
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>プロジェクト</Text>
                        <Select
                            placeholder="全プロジェクト"
                            allowClear
                            value={projectId}
                            onChange={setProjectId}
                            style={{ width: 200 }}
                        >
                            {projects.map((p) => (
                                <Select.Option key={p.id} value={p.id}>
                                    {p.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>ステータス</Text>
                        <Select
                            value={approvedOnly ? "approved" : "all"}
                            onChange={(v) => setApprovedOnly(v === "approved")}
                            style={{ width: 140 }}
                        >
                            <Select.Option value="all">全て</Select.Option>
                            <Select.Option value="approved">承認済のみ</Select.Option>
                        </Select>
                    </div>
                    <div style={{ alignSelf: "flex-end" }}>
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={handleSearch}
                            loading={isPending}
                        >
                            集計
                        </Button>
                    </div>
                </Space>
            </Card>

            {/* エラー表示 */}
            {hasError && (
                <Card style={{ marginBottom: 16 }}>
                    <Empty description="データの取得に失敗しました。再度お試しください" />
                </Card>
            )}

            {/* サマリーカード */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="合計金額"
                            value={statsData.total_amount}
                            prefix={<DollarOutlined />}
                            formatter={(value) => `¥${Number(value).toLocaleString()}`}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="件数"
                            value={statsData.total_count}
                            suffix="件"
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="平均金額"
                            value={statsData.avg_amount}
                            formatter={(value) => `¥${Number(value).toLocaleString()}`}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="最高金額"
                            value={statsData.max_amount}
                            formatter={(value) => `¥${Number(value).toLocaleString()}`}
                        />
                    </Card>
                </Col>
            </Row>

            {/* 集計タブ */}
            <Card>
                <Tabs
                    defaultActiveKey="category"
                    items={[
                        {
                            key: "category",
                            label: "カテゴリ別",
                            children: (
                                <Row gutter={24}>
                                    <Col span={8}>
                                        {/* グラフ代替: Progress バーで構成比を視覚化 */}
                                        <Card title="構成比" size="small">
                                            {categoryData.length === 0 ? (
                                                <Empty description="データがありません" />
                                            ) : (
                                                <div style={{ padding: "8px 0" }}>
                                                    {categoryData.map((c, i) => (
                                                        <div key={c.category} style={{ marginBottom: 12 }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                                <Tag color={CATEGORY_COLORS[c.category] || "default"}>{c.category}</Tag>
                                                                <Text type="secondary">{c.percentage.toFixed(1)}%</Text>
                                                            </div>
                                                            <Progress
                                                                percent={c.percentage}
                                                                showInfo={false}
                                                                strokeColor={PROGRESS_COLORS[i % PROGRESS_COLORS.length]}
                                                                size="small"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                    <Col span={16}>
                                        <Table
                                            dataSource={categoryData}
                                            columns={categoryColumns}
                                            rowKey="category"
                                            pagination={false}
                                            size="small"
                                            locale={{ emptyText: "該当する経費データがありません" }}
                                            summary={() =>
                                                categoryData.length > 0 ? (
                                                    <Table.Summary.Row>
                                                        <Table.Summary.Cell index={0}>
                                                            <Text strong>合計</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={1} align="right">
                                                            <Text strong>{categoryCountTotal}</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={2} align="right">
                                                            <Text strong>¥{categoryTotal.toLocaleString()}</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={3} align="right">
                                                            <Text strong>100.0%</Text>
                                                        </Table.Summary.Cell>
                                                    </Table.Summary.Row>
                                                ) : null
                                            }
                                        />
                                    </Col>
                                </Row>
                            ),
                        },
                        {
                            key: "project",
                            label: "PJ別",
                            children: (
                                <Row gutter={24}>
                                    <Col span={8}>
                                        {/* グラフ代替: Progress バーで金額比較 */}
                                        <Card title="金額比較" size="small">
                                            {projectData.length === 0 ? (
                                                <Empty description="データがありません" />
                                            ) : (
                                                <div style={{ padding: "8px 0" }}>
                                                    {projectData.map((p, i) => {
                                                        const pct = projectTotal > 0
                                                            ? Math.round((p.total_amount / projectTotal) * 100)
                                                            : 0;
                                                        return (
                                                            <div key={p.id} style={{ marginBottom: 12 }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                                    <Text ellipsis style={{ maxWidth: 140 }}>{p.name}</Text>
                                                                    <Text type="secondary">¥{p.total_amount.toLocaleString()}</Text>
                                                                </div>
                                                                <Progress
                                                                    percent={pct}
                                                                    showInfo={false}
                                                                    strokeColor={PROGRESS_COLORS[i % PROGRESS_COLORS.length]}
                                                                    size="small"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                    <Col span={16}>
                                        <Table
                                            dataSource={projectData}
                                            columns={projectColumns}
                                            rowKey="id"
                                            pagination={false}
                                            size="small"
                                            locale={{ emptyText: "該当する経費データがありません" }}
                                            summary={() =>
                                                projectData.length > 0 ? (
                                                    <Table.Summary.Row>
                                                        <Table.Summary.Cell index={0}>
                                                            <Text strong>合計</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={1} align="right">
                                                            <Text strong>{projectCountTotal}</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={2} align="right">
                                                            <Text strong>¥{projectTotal.toLocaleString()}</Text>
                                                        </Table.Summary.Cell>
                                                    </Table.Summary.Row>
                                                ) : null
                                            }
                                        />
                                    </Col>
                                </Row>
                            ),
                        },
                        {
                            key: "monthly",
                            label: "月別推移",
                            children: (
                                <Row gutter={24}>
                                    <Col span={8}>
                                        {/* グラフ代替: Progress バーで月別推移 */}
                                        <Card title="月別推移" size="small">
                                            {monthData.length === 0 ? (
                                                <Empty description="データがありません" />
                                            ) : (
                                                <div style={{ padding: "8px 0" }}>
                                                    {monthData.map((m, i) => {
                                                        const maxAmount = Math.max(...monthData.map((d) => d.total_amount));
                                                        const pct = maxAmount > 0
                                                            ? Math.round((m.total_amount / maxAmount) * 100)
                                                            : 0;
                                                        const [y, mo] = m.month.split("-");
                                                        return (
                                                            <div key={m.month} style={{ marginBottom: 12 }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                                    <Text>{y}年{mo}月</Text>
                                                                    <Text type="secondary">¥{m.total_amount.toLocaleString()}</Text>
                                                                </div>
                                                                <Progress
                                                                    percent={pct}
                                                                    showInfo={false}
                                                                    strokeColor={PROGRESS_COLORS[i % PROGRESS_COLORS.length]}
                                                                    size="small"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </Card>
                                    </Col>
                                    <Col span={16}>
                                        <Table
                                            dataSource={monthData}
                                            columns={monthColumns}
                                            rowKey="month"
                                            pagination={false}
                                            size="small"
                                            locale={{ emptyText: "該当する経費データがありません" }}
                                            summary={() =>
                                                monthData.length > 0 ? (
                                                    <Table.Summary.Row>
                                                        <Table.Summary.Cell index={0}>
                                                            <Text strong>合計</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={1} align="right">
                                                            <Text strong>{monthCountTotal}</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={2} align="right">
                                                            <Text strong>¥{monthTotal.toLocaleString()}</Text>
                                                        </Table.Summary.Cell>
                                                    </Table.Summary.Row>
                                                ) : null
                                            }
                                        />
                                    </Col>
                                </Row>
                            ),
                        },
                    ]}
                />
            </Card>
        </div>
    );
}
