"use client";

import { useState } from "react";
import { Button, Card, Form, Input, Typography, message, Space } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (values: { email: string; password: string }) => {
        setLoading(true);
        const supabase = createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
        });

        if (error) {
            message.error(
                error.message === "Invalid login credentials"
                    ? "メールアドレスまたはパスワードが正しくありません"
                    : error.message
            );
            setLoading(false);
            return;
        }

        message.success("ログインしました");
        router.push("/");
        router.refresh();
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
        >
            <Card
                style={{
                    width: 420,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                    borderRadius: 12,
                }}
            >
                <Space
                    direction="vertical"
                    size="large"
                    style={{ width: "100%", textAlign: "center" }}
                >
                    <div>
                        <Title level={2} style={{ marginBottom: 4 }}>
                            OpsHub
                        </Title>
                        <Text type="secondary">業務統合SaaS にログイン</Text>
                    </div>

                    <Form
                        layout="vertical"
                        onFinish={handleLogin}
                        autoComplete="off"
                        requiredMark={false}
                    >
                        <Form.Item
                            name="email"
                            rules={[
                                { required: true, message: "メールアドレスを入力してください" },
                                { type: "email", message: "有効なメールアドレスを入力してください" },
                            ]}
                        >
                            <Input
                                prefix={<MailOutlined />}
                                placeholder="メールアドレス"
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[
                                { required: true, message: "パスワードを入力してください" },
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="パスワード"
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                block
                                size="large"
                            >
                                ログイン
                            </Button>
                        </Form.Item>
                    </Form>
                </Space>
            </Card>
        </div>
    );
}
