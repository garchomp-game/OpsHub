"use client";

import { useMemo } from "react";
import { Tabs, Card, Tag, Empty, Badge, Typography, Space } from "antd";
import {
    FileTextOutlined,
    ProjectOutlined,
    CheckSquareOutlined,
    DollarOutlined,
    AppstoreOutlined,
    RightOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchAllResponse, SearchResult } from "../_actions";

const { Text, Paragraph } = Typography;

// ─── ステータス色定義 ─────────────────────────────

const STATUS_CONFIG: Record<string, Record<string, { label: string; color: string }>> = {
    workflow: {
        draft: { label: "下書き", color: "blue" },
        submitted: { label: "申請中", color: "orange" },
        approved: { label: "承認済", color: "green" },
        rejected: { label: "差戻し", color: "red" },
        withdrawn: { label: "取下げ", color: "default" },
    },
    project: {
        planning: { label: "計画中", color: "blue" },
        active: { label: "進行中", color: "green" },
        completed: { label: "完了", color: "default" },
        archived: { label: "アーカイブ", color: "default" },
    },
    task: {
        todo: { label: "未着手", color: "blue" },
        in_progress: { label: "進行中", color: "orange" },
        done: { label: "完了", color: "green" },
    },
    expense: {
        draft: { label: "下書き", color: "blue" },
        submitted: { label: "申請中", color: "orange" },
        approved: { label: "承認済", color: "green" },
        rejected: { label: "差戻し", color: "red" },
    },
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
    workflow: <FileTextOutlined style={{ color: "#1677ff" }} />,
    project: <ProjectOutlined style={{ color: "#52c41a" }} />,
    task: <CheckSquareOutlined style={{ color: "#fa8c16" }} />,
    expense: <DollarOutlined style={{ color: "#722ed1" }} />,
};

const CATEGORY_LABEL: Record<string, string> = {
    workflow: "ワークフロー",
    project: "プロジェクト",
    task: "タスク",
    expense: "経費",
};

// ─── キーワードハイライト ─────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{ background: "#fff566", padding: 0 }}>
                {part}
            </mark>
        ) : (
            part
        )
    );
}

// ─── スニペット抽出 ───────────────────────────────

function extractSnippet(description: string | undefined, query: string): string | null {
    if (!description) return null;
    const idx = description.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return description.slice(0, 100);
    const start = Math.max(0, idx - 50);
    const end = Math.min(description.length, idx + query.length + 50);
    let snippet = description.slice(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < description.length) snippet = snippet + "...";
    return snippet;
}

// ─── 結果カード ───────────────────────────────────

function ResultCard({ item, query }: { item: SearchResult; query: string }) {
    const statusInfo = STATUS_CONFIG[item.category]?.[item.status];
    const snippet = extractSnippet(item.description, query);
    const dateStr = new Date(item.createdAt).toLocaleDateString("ja-JP");

    return (
        <Link href={item.link} style={{ display: "block", textDecoration: "none" }}>
            <Card
                hoverable
                size="small"
                style={{ marginBottom: 12 }}
                styles={{
                    body: { padding: "16px 20px" },
                }}
            >
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Space size={8}>
                            {CATEGORY_ICON[item.category]}
                            <Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                            >
                                {CATEGORY_LABEL[item.category]}
                            </Text>
                        </Space>
                        {statusInfo && (
                            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                        )}
                    </div>
                    <Text strong style={{ fontSize: 15 }}>
                        {highlightText(item.title, query)}
                    </Text>
                    {snippet && (
                        <Paragraph
                            type="secondary"
                            style={{ fontSize: 13, marginBottom: 0 }}
                            ellipsis={{ rows: 2 }}
                        >
                            {highlightText(snippet, query)}
                        </Paragraph>
                    )}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            作成日: {dateStr}
                        </Text>
                        {item.metadata?.amount !== undefined && (
                            <Text style={{ fontSize: 13 }}>
                                ¥{item.metadata.amount.toLocaleString()}
                            </Text>
                        )}
                        <Space size={4} style={{ color: "#1677ff", fontSize: 13 }}>
                            詳細を見る <RightOutlined style={{ fontSize: 10 }} />
                        </Space>
                    </div>
                </Space>
            </Card>
        </Link>
    );
}

// ─── メインコンポーネント ──────────────────────────

interface SearchResultsClientProps {
    data: SearchAllResponse;
    query: string;
    currentCategory: string;
}

export default function SearchResultsClient({
    data,
    query,
    currentCategory,
}: SearchResultsClientProps) {
    const router = useRouter();

    // カテゴリ別にフィルタ
    const filteredResults = useMemo(() => {
        if (currentCategory === "all") return data.results;
        const categoryMap: Record<string, string> = {
            workflows: "workflow",
            projects: "project",
            tasks: "task",
            expenses: "expense",
        };
        const cat = categoryMap[currentCategory];
        return data.results.filter((r) => r.category === cat);
    }, [data.results, currentCategory]);

    const handleTabChange = (key: string) => {
        const params = new URLSearchParams();
        params.set("q", query);
        if (key !== "all") {
            params.set("category", key);
        }
        router.push(`/search?${params.toString()}`);
    };

    const tabItems = [
        {
            key: "all",
            label: (
                <Space size={4}>
                    <AppstoreOutlined />
                    すべて
                    <Badge count={data.counts.all} showZero size="small" style={{ backgroundColor: "#8c8c8c" }} />
                </Space>
            ),
        },
        {
            key: "workflows",
            label: (
                <Space size={4}>
                    <FileTextOutlined />
                    ワークフロー
                    <Badge count={data.counts.workflows} showZero size="small" style={{ backgroundColor: "#1677ff" }} />
                </Space>
            ),
        },
        {
            key: "projects",
            label: (
                <Space size={4}>
                    <ProjectOutlined />
                    プロジェクト
                    <Badge count={data.counts.projects} showZero size="small" style={{ backgroundColor: "#52c41a" }} />
                </Space>
            ),
        },
        {
            key: "tasks",
            label: (
                <Space size={4}>
                    <CheckSquareOutlined />
                    タスク
                    <Badge count={data.counts.tasks} showZero size="small" style={{ backgroundColor: "#fa8c16" }} />
                </Space>
            ),
        },
        {
            key: "expenses",
            label: (
                <Space size={4}>
                    <DollarOutlined />
                    経費
                    <Badge count={data.counts.expenses} showZero size="small" style={{ backgroundColor: "#722ed1" }} />
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Tabs
                activeKey={currentCategory}
                items={tabItems}
                onChange={handleTabChange}
                style={{ marginBottom: 16 }}
            />
            {filteredResults.length === 0 ? (
                <Empty
                    description={
                        <span>
                            「{query}」に一致する結果が見つかりませんでした
                            <br />
                            <Text type="secondary">別のキーワードで検索してみてください</Text>
                        </span>
                    }
                    style={{ padding: "48px 0" }}
                />
            ) : (
                <div>
                    {filteredResults.map((item) => (
                        <ResultCard key={`${item.category}-${item.id}`} item={item} query={query} />
                    ))}
                </div>
            )}
        </div>
    );
}
