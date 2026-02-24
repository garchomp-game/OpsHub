"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Tabs,
    Card,
    Form,
    Input,
    Button,
    Descriptions,
    Statistic,
    Row,
    Col,
    Switch,
    InputNumber,
    Select,
    message,
    Popconfirm,
    Spin,
    Typography,
    Space,
    Divider,
    Alert,
} from "antd";
import {
    SaveOutlined,
    DeleteOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import {
    getTenantDetail,
    updateTenant,
    updateTenantSettings,
    deleteTenant,
    type TenantDetail,
    type TenantSettings,
} from "../_actions";

const { Title, Text } = Typography;

type Props = {
    tenantId: string;
    isItAdmin: boolean;
};

export default function TenantManagement({ tenantId, isItAdmin }: Props) {
    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [basicForm] = Form.useForm();
    const [settingsForm] = Form.useForm();

    const fetchTenant = useCallback(async () => {
        setLoading(true);
        const result = await getTenantDetail(tenantId);
        if (result.success) {
            setTenant(result.data);
            basicForm.setFieldsValue({
                name: result.data.name,
                contact_email:
                    (result.data.settings as Record<string, unknown>)
                        .contact_email ?? "",
                address:
                    (result.data.settings as Record<string, unknown>)
                        .address ?? "",
            });
            settingsForm.setFieldsValue({
                timezone: result.data.settings.timezone ?? "Asia/Tokyo",
                fiscal_year_start:
                    result.data.settings.fiscal_year_start ?? 4,
                notification_email:
                    result.data.settings.notification_email ?? true,
                notification_in_app:
                    result.data.settings.notification_in_app ?? true,
                default_approval_route:
                    result.data.settings.default_approval_route ?? "",
            });
        } else {
            message.error(result.error.message);
        }
        setLoading(false);
    }, [tenantId, basicForm, settingsForm]);

    useEffect(() => {
        fetchTenant();
    }, [fetchTenant]);

    const handleUpdateBasic = async (values: {
        name: string;
        contact_email: string;
        address: string;
    }) => {
        setSaving(true);
        const result = await updateTenant({
            tenantId,
            name: values.name,
            contact_email: values.contact_email,
            address: values.address,
        });
        if (result.success) {
            message.success("テナント情報を更新しました");
            fetchTenant();
        } else {
            message.error(result.error.message);
        }
        setSaving(false);
    };

    const handleUpdateSettings = async (values: TenantSettings) => {
        setSaving(true);
        const result = await updateTenantSettings({
            tenantId,
            settings: values,
        });
        if (result.success) {
            message.success("テナント設定を更新しました");
            fetchTenant();
        } else {
            message.error(result.error.message);
        }
        setSaving(false);
    };

    const handleDeleteTenant = async () => {
        setSaving(true);
        const result = await deleteTenant({
            tenantId,
            confirmation: deleteConfirmation,
        });
        if (result.success) {
            message.success("テナントを削除しました。30日間は復元可能です。");
            window.location.href = "/login";
        } else {
            message.error(result.error.message);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 64,
                }}
            >
                <Spin size="large" />
            </div>
        );
    }

    if (!tenant) {
        return <Alert type="error" message="テナント情報の読み込みに失敗しました" />;
    }

    const tabItems = [
        {
            key: "basic",
            label: "基本情報",
            children: (
                <Card>
                    <Descriptions
                        column={1}
                        bordered
                        style={{ marginBottom: 24 }}
                    >
                        <Descriptions.Item label="テナントID">
                            {tenant.slug}
                        </Descriptions.Item>
                        <Descriptions.Item label="作成日">
                            {new Date(tenant.created_at).toLocaleDateString(
                                "ja-JP"
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="最終更新">
                            {new Date(tenant.updated_at).toLocaleDateString(
                                "ja-JP"
                            )}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider>編集</Divider>
                    <Form
                        form={basicForm}
                        layout="vertical"
                        onFinish={handleUpdateBasic}
                        style={{ maxWidth: 600 }}
                    >
                        <Form.Item
                            name="name"
                            label="組織名"
                            rules={[
                                {
                                    required: true,
                                    message: "組織名は必須です",
                                },
                                {
                                    max: 100,
                                    message:
                                        "組織名は100文字以内で入力してください",
                                },
                            ]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="contact_email"
                            label="連絡先メール"
                            rules={[
                                {
                                    type: "email",
                                    message:
                                        "有効なメールアドレスを入力してください",
                                },
                            ]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="address" label="住所">
                            <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<SaveOutlined />}
                                loading={saving}
                            >
                                保存
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            ),
        },
        {
            key: "settings",
            label: "設定",
            children: (
                <Card>
                    <Form
                        form={settingsForm}
                        layout="vertical"
                        onFinish={handleUpdateSettings}
                        style={{ maxWidth: 600 }}
                    >
                        <Form.Item
                            name="timezone"
                            label="タイムゾーン"
                        >
                            <Select
                                options={[
                                    {
                                        label: "Asia/Tokyo",
                                        value: "Asia/Tokyo",
                                    },
                                    {
                                        label: "UTC",
                                        value: "UTC",
                                    },
                                    {
                                        label: "America/New_York",
                                        value: "America/New_York",
                                    },
                                    {
                                        label: "Europe/London",
                                        value: "Europe/London",
                                    },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item
                            name="fiscal_year_start"
                            label="会計年度の開始月"
                            rules={[
                                {
                                    type: "number",
                                    min: 1,
                                    max: 12,
                                    message:
                                        "会計年度の開始月は1〜12で指定してください",
                                },
                            ]}
                        >
                            <InputNumber min={1} max={12} />
                        </Form.Item>
                        <Form.Item
                            name="notification_email"
                            label="メール通知"
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>
                        <Form.Item
                            name="notification_in_app"
                            label="アプリ内通知"
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>
                        <Form.Item
                            name="default_approval_route"
                            label="デフォルト承認経路"
                        >
                            <Input placeholder="任意" />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<SaveOutlined />}
                                loading={saving}
                            >
                                設定を保存
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            ),
        },
        {
            key: "usage",
            label: "利用状況",
            children: (
                <Card>
                    <Row gutter={[24, 24]}>
                        <Col xs={24} sm={8}>
                            <Card bordered>
                                <Statistic
                                    title="アクティブユーザー"
                                    value={tenant.stats.active_users}
                                    suffix="名"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card bordered>
                                <Statistic
                                    title="プロジェクト数"
                                    value={tenant.stats.project_count}
                                    suffix="件"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card bordered>
                                <Statistic
                                    title="ワークフロー申請数"
                                    value={
                                        tenant.stats.monthly_workflows
                                    }
                                    suffix="件"
                                />
                            </Card>
                        </Col>
                    </Row>
                    <div style={{ marginTop: 16 }}>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchTenant}
                        >
                            更新
                        </Button>
                    </div>
                </Card>
            ),
        },
    ];

    return (
        <div>
            <Title level={3}>テナント管理</Title>
            <Tabs items={tabItems} />

            {isItAdmin && (
                <Card
                    style={{
                        marginTop: 24,
                        borderColor: "#ff4d4f",
                    }}
                >
                    <Title level={5} type="danger">
                        ⚠️ 危険な操作
                    </Title>
                    <Text type="secondary">
                        テナントを削除すると、全てのデータが論理削除されます。30日間は復元可能ですが、期限後に完全に削除されます。
                    </Text>
                    <div style={{ marginTop: 16 }}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                            <Text>
                                確認のため、テナント名「
                                <Text strong>{tenant.name}</Text>
                                」を入力してください:
                            </Text>
                            <Input
                                value={deleteConfirmation}
                                onChange={(e) =>
                                    setDeleteConfirmation(e.target.value)
                                }
                                placeholder="テナント名を入力"
                                style={{ maxWidth: 400 }}
                            />
                            <Popconfirm
                                title="本当にテナントを削除しますか？"
                                description="テナントは30日間復元可能です。30日後に完全に削除されます。"
                                onConfirm={handleDeleteTenant}
                                okText="削除する"
                                cancelText="キャンセル"
                                okButtonProps={{ danger: true }}
                            >
                                <Button
                                    danger
                                    type="primary"
                                    icon={<DeleteOutlined />}
                                    loading={saving}
                                    disabled={
                                        deleteConfirmation !== tenant.name
                                    }
                                >
                                    テナントを削除
                                </Button>
                            </Popconfirm>
                        </Space>
                    </div>
                </Card>
            )}
        </div>
    );
}
