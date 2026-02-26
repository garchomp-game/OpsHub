"use client";

import { Typography, Space } from "antd";

const { Title, Text } = Typography;

interface SearchResultsWrapperProps {
    query: string;
    totalCount?: number;
    errorMessage: string | null;
    children: React.ReactNode;
}

export default function SearchResultsWrapper({
    query,
    totalCount,
    errorMessage,
    children,
}: SearchResultsWrapperProps) {
    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={3} style={{ marginBottom: 8 }}>
                    検索結果: &ldquo;{query}&rdquo;
                </Title>
                {totalCount !== undefined && (
                    <Text type="secondary">{totalCount} 件ヒット</Text>
                )}
            </div>
            {errorMessage ? (
                <Text type="danger">{errorMessage}</Text>
            ) : (
                children
            )}
        </Space>
    );
}
