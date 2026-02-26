"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    App,
    Typography,
    Card,
    Descriptions,
    Tag,
    Button,
    Space,
    Popconfirm,
    Form,
    Input,
    InputNumber,
    Select,
    Alert,
    Divider,
    Modal,
} from "antd";
import { updateWorkflow, transitionWorkflow, approveWorkflow, rejectWorkflow } from "../../_actions";

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "下書き", color: "default" },
    submitted: { label: "申請中", color: "processing" },
    approved: { label: "承認済", color: "success" },
    rejected: { label: "差戻し", color: "error" },
    withdrawn: { label: "取下げ", color: "warning" },
};

const TYPE_LABELS: Record<string, string> = {
    expense: "経費申請",
    leave: "休暇申請",
    purchase: "購入申請",
    other: "その他",
};

type Workflow = {
    id: string;
    workflow_number: string;
    type: string;
    title: string;
    description: string | null;
    amount: number | null;
    date_from: string | null;
    date_to: string | null;
    status: string;
    approver_id: string | null;
    rejection_reason: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
};

type Approver = {
    user_id: string;
    role: string;
    display_name: string;
};

type Props = {
    workflow: Workflow;
    isOwner: boolean;
    isApprover: boolean;
    approvers: Approver[];
    profileMap: Record<string, string>;
};

export default function WorkflowDetailClient({
    workflow,
    isOwner,
    isApprover,
    approvers,
    profileMap,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { message } = App.useApp();
    const [isEditing, setIsEditing] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");


    const statusInfo = STATUS_LABELS[workflow.status] || { label: workflow.status, color: "default" };
    const canEdit = isOwner && (workflow.status === "draft" || workflow.status === "rejected");
    const canSubmit = isOwner && (workflow.status === "draft" || workflow.status === "rejected");
    const canWithdraw = isOwner && (workflow.status === "submitted" || workflow.status === "rejected");

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await transitionWorkflow({
                workflow_id: workflow.id,
                action: "submit",
            });
            if (result.success) {
                message.success("申請を送信しました");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleWithdraw = () => {
        startTransition(async () => {
            const result = await transitionWorkflow({
                workflow_id: workflow.id,
                action: "withdraw",
            });
            if (result.success) {
                message.success("申請を取り下げました");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveWorkflow({
                workflow_id: workflow.id,
            });
            if (result.success) {
                message.success("申請を承認しました");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleReject = () => {
        if (!rejectionReason.trim()) {
            message.error("差戻し理由を入力してください");
            return;
        }
        startTransition(async () => {
            const result = await rejectWorkflow({
                workflow_id: workflow.id,
                reason: rejectionReason,
            });
            if (result.success) {
                message.success("申請を差し戻しました");
                setRejectModalOpen(false);
                setRejectionReason("");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleSaveEdit = (values: Record<string, unknown>) => {
        startTransition(async () => {
            const result = await updateWorkflow({
                workflow_id: workflow.id,
                title: values.title as string,
                description: values.description as string | undefined,
                amount: values.amount as number | undefined,
                approver_id: values.approver_id as string | undefined,
            });
            if (result.success) {
                message.success("保存しました");
                setIsEditing(false);
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    if (isEditing) {
        return (
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <Title level={2}>申請を編集</Title>
                <Card>
                    <Form
                        layout="vertical"
                        initialValues={{
                            title: workflow.title,
                            description: workflow.description,
                            amount: workflow.amount,
                            approver_id: workflow.approver_id,
                        }}
                        onFinish={handleSaveEdit}
                    >
                        <Form.Item
                            name="title"
                            label="タイトル"
                            rules={[{ required: true, message: "タイトルは必須です" }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="description" label="説明">
                            <TextArea rows={4} />
                        </Form.Item>
                        {(workflow.type === "expense" || workflow.type === "purchase") && (
                            <Form.Item name="amount" label="金額">
                                <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                        )}
                        <Form.Item
                            name="approver_id"
                            label="承認者"
                            rules={[{ required: true, message: "承認者を選択してください" }]}
                        >
                            <Select>
                                {approvers.map((a) => (
                                    <Select.Option key={a.user_id} value={a.user_id}>
                                        {a.display_name}（{a.role}）
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item>
                            <Space>
                                <Button type="primary" htmlType="submit" loading={isPending}>
                                    保存
                                </Button>
                                <Button onClick={() => setIsEditing(false)}>キャンセル</Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Card>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
                <Space>
                    <Button onClick={() => router.push("/workflows")}>← 申請一覧</Button>
                    {isApprover && (
                        <Button onClick={() => router.push("/workflows/pending")}>← 承認待ち一覧</Button>
                    )}
                </Space>
            </div>

            {workflow.status === "rejected" && workflow.rejection_reason && (
                <Alert
                    message="差戻し理由"
                    description={workflow.rejection_reason}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Card>
                <Descriptions
                    title={
                        <Space>
                            <Text strong style={{ fontSize: 18 }}>{workflow.workflow_number}</Text>
                            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                        </Space>
                    }
                    bordered
                    column={2}
                >
                    <Descriptions.Item label="種別">{TYPE_LABELS[workflow.type] || workflow.type}</Descriptions.Item>
                    <Descriptions.Item label="タイトル">{workflow.title}</Descriptions.Item>
                    <Descriptions.Item label="説明" span={2}>
                        {workflow.description || "—"}
                    </Descriptions.Item>
                    {workflow.amount != null && (
                        <Descriptions.Item label="金額">
                            ¥{workflow.amount.toLocaleString()}
                        </Descriptions.Item>
                    )}
                    {workflow.date_from && (
                        <Descriptions.Item label="期間">
                            {workflow.date_from} ～ {workflow.date_to || "—"}
                        </Descriptions.Item>
                    )}
                    <Descriptions.Item label="承認者">{workflow.approver_id ? (profileMap[workflow.approver_id] ?? workflow.approver_id) : "—"}</Descriptions.Item>
                    <Descriptions.Item label="申請者">{profileMap[workflow.created_by] ?? workflow.created_by}</Descriptions.Item>
                    <Descriptions.Item label="作成日">
                        {new Date(workflow.created_at).toLocaleDateString("ja-JP")}
                    </Descriptions.Item>
                    <Descriptions.Item label="更新日">
                        {new Date(workflow.updated_at).toLocaleDateString("ja-JP")}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            <Divider />

            <Space>
                {canEdit && (
                    <Button onClick={() => setIsEditing(true)}>編集</Button>
                )}
                {canSubmit && (
                    <Popconfirm
                        title="この申請を送信しますか？"
                        onConfirm={handleSubmit}
                        okText="送信"
                        cancelText="キャンセル"
                    >
                        <Button type="primary" loading={isPending}>
                            {workflow.status === "rejected" ? "再送信" : "送信"}
                        </Button>
                    </Popconfirm>
                )}
                {canWithdraw && (
                    <Popconfirm
                        title="この申請を取り下げますか？"
                        onConfirm={handleWithdraw}
                        okText="取下げ"
                        cancelText="キャンセル"
                    >
                        <Button danger loading={isPending}>取下げ</Button>
                    </Popconfirm>
                )}
                {isApprover && (
                    <>
                        <Popconfirm
                            title="この申請を承認しますか？"
                            description="承認後は取り消しできません。"
                            onConfirm={handleApprove}
                            okText="承認"
                            cancelText="キャンセル"
                        >
                            <Button type="primary" style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }} loading={isPending}>
                                承認
                            </Button>
                        </Popconfirm>
                        <Button danger onClick={() => setRejectModalOpen(true)} loading={isPending}>
                            差戻し
                        </Button>
                    </>
                )}
            </Space>

            <Modal
                title="差戻し理由を入力"
                open={rejectModalOpen}
                onOk={handleReject}
                onCancel={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                }}
                okText="差戻し"
                cancelText="キャンセル"
                okButtonProps={{ danger: true, loading: isPending }}
            >
                <p style={{ marginBottom: 8, color: "#666" }}>
                    申請者が修正しやすいよう、具体的な理由を記入してください。
                </p>
                <TextArea
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="例: 領収書の添付がありません。添付の上、再送信してください"
                />
            </Modal>
        </div>
    );
}
