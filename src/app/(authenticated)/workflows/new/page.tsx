"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Form,
    Input,
    Select,
    InputNumber,
    DatePicker,
    Button,
    Card,
    Typography,
    message,
    Space,
    Divider,
} from "antd";
import { createWorkflow, getApprovers } from "../_actions";

const { Title } = Typography;
const { TextArea } = Input;

type Approver = {
    user_id: string;
    role: string;
    display_name: string;
};

export default function NewWorkflowPage() {
    const router = useRouter();
    const [form] = Form.useForm();
    const [isPending, startTransition] = useTransition();
    const [approvers, setApprovers] = useState<Approver[]>([]);
    const [selectedType, setSelectedType] = useState<string>("other");

    useEffect(() => {
        const loadApprovers = async () => {
            const result = await getApprovers(undefined as unknown as void);
            if (result.success) {
                setApprovers(result.data);
            }
        };
        loadApprovers();
    }, []);

    const onFinish = (values: Record<string, unknown>, asDraft: boolean) => {
        startTransition(async () => {
            const result = await createWorkflow({
                type: values.type as "expense" | "leave" | "purchase" | "other",
                title: values.title as string,
                description: values.description as string | undefined,
                amount: values.amount as number | undefined,
                date_from: values.date_from
                    ? (values.date_from as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : undefined,
                date_to: values.date_to
                    ? (values.date_to as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : undefined,
                approver_id: values.approver_id as string,
                status: asDraft ? "draft" : "submitted",
            });

            if (result.success) {
                message.success(asDraft ? "下書きを保存しました" : "申請を送信しました");
                router.push("/workflows");
            } else {
                message.error(result.error.message);
            }
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Title level={2}>新規申請</Title>

            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                    initialValues={{ type: "other" }}
                    onValuesChange={(changed) => {
                        if (changed.type) setSelectedType(changed.type);
                    }}
                >
                    <Form.Item
                        name="type"
                        label="申請種別"
                        rules={[{ required: true, message: "申請種別を選択してください" }]}
                    >
                        <Select>
                            <Select.Option value="expense">経費申請</Select.Option>
                            <Select.Option value="leave">休暇申請</Select.Option>
                            <Select.Option value="purchase">購入申請</Select.Option>
                            <Select.Option value="other">その他</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="title"
                        label="タイトル"
                        rules={[
                            { required: true, message: "タイトルは必須です" },
                            { max: 200, message: "200文字以内で入力してください" },
                        ]}
                    >
                        <Input placeholder="例: 2月出張交通費" />
                    </Form.Item>

                    <Form.Item name="description" label="説明">
                        <TextArea rows={4} placeholder="申請の詳細な説明" />
                    </Form.Item>

                    {(selectedType === "expense" || selectedType === "purchase") && (
                        <Form.Item
                            name="amount"
                            label="金額"
                            rules={selectedType === "expense" ? [{ required: true, message: "金額を入力してください" }] : []}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                placeholder="0"
                                formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                parser={(value) => Number(value?.replace(/¥\s?|(,*)/g, "") ?? 0) as unknown as 0}
                            />
                        </Form.Item>
                    )}

                    {selectedType === "leave" && (
                        <Space size="middle" style={{ display: "flex" }}>
                            <Form.Item
                                name="date_from"
                                label="開始日"
                                rules={[{ required: true, message: "開始日を選択してください" }]}
                                style={{ flex: 1 }}
                            >
                                <DatePicker style={{ width: "100%" }} placeholder="開始日" />
                            </Form.Item>
                            <Form.Item
                                name="date_to"
                                label="終了日"
                                rules={[{ required: true, message: "終了日を選択してください" }]}
                                style={{ flex: 1 }}
                            >
                                <DatePicker style={{ width: "100%" }} placeholder="終了日" />
                            </Form.Item>
                        </Space>
                    )}

                    <Form.Item
                        name="approver_id"
                        label="承認者"
                        rules={[{ required: true, message: "承認者を選択してください" }]}
                    >
                        <Select placeholder="承認者を選択">
                            {approvers.map((a) => (
                                <Select.Option key={a.user_id} value={a.user_id}>
                                    {a.display_name}（{a.role}）
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
                            <Button onClick={() => router.push("/workflows")}>
                                キャンセル
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
