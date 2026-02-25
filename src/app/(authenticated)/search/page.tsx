import { searchAll, type SearchAllResponse } from "./_actions";
import SearchResultsClient from "./_components/SearchResultsClient";
import { Typography, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string;
        category?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = (params.q ?? "").trim();

    // 空クエリ → 入力案内
    if (!query) {
        return (
            <div style={{ textAlign: "center", padding: "80px 24px" }}>
                <SearchOutlined style={{ fontSize: 48, color: "#bfbfbf", marginBottom: 16 }} />
                <Title level={4} style={{ color: "#8c8c8c" }}>
                    検索キーワードを入力してください
                </Title>
                <Text type="secondary">
                    ヘッダーの検索バーにキーワードを入力して検索できます
                </Text>
            </div>
        );
    }

    // 検索実行
    const category = (params.category ?? "all") as "all" | "workflows" | "projects" | "tasks" | "expenses";
    const page = parseInt(params.page ?? "1", 10) || 1;

    const result = await searchAll({ query, category, page });

    let data: SearchAllResponse | null = null;
    let errorMessage: string | null = null;

    if (result.success) {
        data = result.data;
    } else {
        errorMessage = result.error.message;
    }

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={3} style={{ marginBottom: 8 }}>
                    検索結果: &ldquo;{query}&rdquo;
                </Title>
                {data && (
                    <Text type="secondary">{data.counts.all} 件ヒット</Text>
                )}
            </div>
            {errorMessage ? (
                <Text type="danger">{errorMessage}</Text>
            ) : data ? (
                <SearchResultsClient
                    data={data}
                    query={query}
                    currentCategory={category}
                />
            ) : null}
        </Space>
    );
}
