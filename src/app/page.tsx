"use client";

import { Button, Card, Space, Typography } from "antd";

const { Title, Paragraph } = Typography;

export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
      }}
    >
      <Card
        style={{ maxWidth: 600, width: "100%" }}
        title="Starlight App"
      >
        <Typography>
          <Title level={3}>Next.js + Ant Design + Supabase</Title>
          <Paragraph>
            プロジェクトが正常にセットアップされました。
          </Paragraph>
        </Typography>
        <Space>
          <Button type="primary">Primary Button</Button>
          <Button>Default Button</Button>
        </Space>
      </Card>
    </div>
  );
}
