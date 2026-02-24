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
        title="OpsHub"
      >
        <Typography>
          <Title level={3}>業務統合SaaS</Title>
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
