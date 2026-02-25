"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    App,
    Form,
    Input,
    Select,
    InputNumber,
    DatePicker,
    Button,
    Card,
    Typography,
    Space,
    Divider,
} from "antd";
import { createExpense, getProjects, getApprovers } from "../_actions";

const { Title } = Typography;
const { TextArea } = Input;

type Project = {
    id: string;
    name: string;
    status: string;
};

type Approver = {
    user_id: string;
    role: string;
    display_name: string;
};

const ROLE_LABELS: Record<string, string> = {
    approver: "承認者",
    accounting: "経理",
    tenant_admin: "テナント管理者",
};

export default function NewExpensePage() {
    const router = useRouter();
    const [form] = Form.useForm();
    const [isPending, startTransition] = useTransition();
    const { message } = App.useApp();
    const [projects, setProjects] = useState<Project[]>([]);
    const [approvers, setApprovers] = useState<Approver[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const [projResult, approverResult] = await Promise.all([
                getProjects(undefined as unknown as void),
                getApprovers(undefined as unknown as void),
            ]);
            if (projResult.success) setProjects(projResult.data);
            if (approverResult.success) setApprovers(approverResult.data);
        };
        loadData();
    }, []);

    const onFinish = (values: Record<string, unknown>, asDraft: boolean) => {
        startTransition(async () => {
            const result = await createExpense({
                category: values.category as "交通費" | "宿泊費" | "会議費" | "消耗品費" | "通信費" | "その他",
                amount: values.amount as number,
                expense_date: values.expense_date
                    ? (values.expense_date as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : "",
                description: values.description as string | undefined,
                project_id: values.project_id as string,
                approver_id: values.approver_id as string,
                status: asDraft ? "draft" : "submitted",
            });

            if (result.success) {
                message.success(asDraft ? "下書きを保存しました" : "経費申請を送信しました");
                router.push("/expenses");
            } else {
                message.error(result.error.message);
            }
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Title level={2}>経費申請</Title>

            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                >
                    <Form.Item
                        name="expense_date"
                        label="日付"
                        rules={[{ required: true, message: "日付を選択してください" }]}
                    >
                        <DatePicker style={{ width: "100%" }} placeholder="経費発生日" />
                    </Form.Item>

                    <Form.Item
                        name="category"
                        label="カテゴリ"
                        rules={[{ required: true, message: "カテゴリを選択してください" }]}
                    >
                        <Select placeholder="カテゴリを選択">
                            <Select.Option value="交通費">交通費</Select.Option>
                            <Select.Option value="宿泊費">宿泊費</Select.Option>
                            <Select.Option value="会議費">会議費</Select.Option>
                            <Select.Option value="消耗品費">消耗品費</Select.Option>
                            <Select.Option value="通信費">通信費</Select.Option>
                            <Select.Option value="その他">その他</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="amount"
                        label="金額"
                        rules={[
                            { required: true, message: "金額を入力してください" },
                        ]}
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            min={1}
                            placeholder="0"
                            formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            parser={(value) => Number(value?.replace(/¥\s?|(,*)/g, "") ?? 0) as unknown as 1}
                        />
                    </Form.Item>

                    <Form.Item
                        name="project_id"
                        label="プロジェクト"
                        rules={[{ required: true, message: "プロジェクトを選択してください" }]}
                    >
                        <Select placeholder="プロジェクトを選択">
                            {projects.map((p) => (
                                <Select.Option key={p.id} value={p.id}>
                                    {p.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="description" label="説明">
                        <TextArea rows={3} placeholder="経費の詳細な説明" />
                    </Form.Item>

                    <Form.Item
                        name="approver_id"
                        label="承認者"
                        rules={[{ required: true, message: "承認者を選択してください" }]}
                    >
                        <Select placeholder="承認者を選択">
                            {approvers.map((a) => (
                                <Select.Option key={a.user_id} value={a.user_id}>
                                    {a.display_name}（{ROLE_LABELS[a.role] || a.role}）
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Divider />

                    <Form.Item>
                        <Space>
                            <Button
                                onClick={() => {
                                    form.validateFields().then((values) => onFinish(values, true));
                                }}
                                loading={isPending}
                            >
                                下書き保存
                            </Button>
                            <Button
                                type="primary"
                                onClick={() => {
                                    form.validateFields().then((values) => onFinish(values, false));
                                }}
                                loading={isPending}
                            >
                                送信
                            </Button>
                            <Button onClick={() => router.push("/expenses")}>
                                キャンセル
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
