"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Form,
    Input,
    DatePicker,
    Select,
    Button,
    Card,
    Typography,
    message,
    Space,
} from "antd";
import { createProject, getTenantUsers } from "../_actions";

const { Title } = Typography;
const { TextArea } = Input;

type TenantUser = {
    user_id: string;
    role: string;
    display_name: string;
};

export default function NewProjectPage() {
    const router = useRouter();
    const [form] = Form.useForm();
    const [isPending, startTransition] = useTransition();
    const [users, setUsers] = useState<TenantUser[]>([]);

    useEffect(() => {
        const loadUsers = async () => {
            const result = await getTenantUsers(undefined as unknown as void);
            if (result.success) {
                setUsers(result.data);
            }
        };
        loadUsers();
    }, []);

    const onFinish = (values: Record<string, unknown>) => {
        startTransition(async () => {
            const result = await createProject({
                name: values.name as string,
                description: values.description as string | undefined,
                start_date: values.start_date
                    ? (values.start_date as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : undefined,
                end_date: values.end_date
                    ? (values.end_date as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : undefined,
                pm_id: values.pm_id as string,
            });

            if (result.success) {
                message.success("プロジェクトを作成しました");
                router.push("/projects");
            } else {
                message.error(result.error.message);
            }
        });
    };

    // PM候補: pm or tenant_admin ロールのユーザーを表示
    const pmCandidates = users.filter(
        (u) => u.role === "pm" || u.role === "tenant_admin"
    );

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Title level={2}>新規プロジェクト</Title>

            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    requiredMark="optional"
                >
                    <Form.Item
                        name="name"
                        label="プロジェクト名"
                        rules={[
                            { required: true, message: "プロジェクト名は必須です" },
                            { max: 100, message: "100文字以内で入力してください" },
                        ]}
                    >
                        <Input placeholder="プロジェクトA" />
                    </Form.Item>

                    <Form.Item name="description" label="説明">
                        <TextArea rows={4} placeholder="プロジェクトの概要を入力" />
                    </Form.Item>

                    <Space size="middle" style={{ display: "flex" }}>
                        <Form.Item name="start_date" label="開始日" style={{ flex: 1 }}>
                            <DatePicker style={{ width: "100%" }} placeholder="開始日" />
                        </Form.Item>
                        <Form.Item name="end_date" label="終了日" style={{ flex: 1 }}>
                            <DatePicker style={{ width: "100%" }} placeholder="終了日" />
                        </Form.Item>
                    </Space>

                    <Form.Item
                        name="pm_id"
                        label="PM（プロジェクトマネージャー）"
                        rules={[{ required: true, message: "PMを選択してください" }]}
                    >
                        <Select placeholder="PMを選択">
                            {pmCandidates.map((u) => (
                                <Select.Option key={u.user_id} value={u.user_id}>
                                    {u.display_name}（{u.role}）
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={isPending}>
                                作成
                            </Button>
                            <Button onClick={() => router.push("/projects")}>
                                キャンセル
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
