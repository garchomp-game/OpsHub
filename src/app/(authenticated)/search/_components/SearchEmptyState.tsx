"use client";

import { Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function SearchEmptyState() {
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
