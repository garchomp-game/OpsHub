"use client";

import { useState } from "react";
import { App, Modal, Form, Input, Checkbox } from "antd";
import { inviteUser } from "../_actions";
import { ROLES, ROLE_LABELS } from "@/types";

type Props = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tenantId: string;
    isItAdmin: boolean;
};



export default function InviteModal({
    open,
    onClose,
    onSuccess,
    tenantId,
    isItAdmin,
}: Props) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { message } = App.useApp();

    // IT Admin でない場合は it_admin ロールを除外
    const availableRoles = ROLES.filter(
        (r) => isItAdmin || r !== "it_admin"
    );

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const result = await inviteUser({
                tenantId,
                email: values.email,
                roles: values.roles,
            });

            if (result.success) {
                message.success("招待メールを送信しました");
                form.resetFields();
                onSuccess();
                onClose();
            } else {
                message.error(result.error.message);
            }
        } catch {
            // バリデーションエラー
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="ユーザー招待"
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={loading}
            okText="招待を送信"
            cancelText="キャンセル"
            destroyOnHidden={false}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{ roles: ["member"] }}
            >
                <Form.Item
                    name="email"
                    label="メールアドレス"
                    rules={[
                        {
                            required: true,
                            message: "メールアドレスを入力してください",
                        },
                        {
                            type: "email",
                            message:
                                "有効なメールアドレスを入力してください",
                        },
                    ]}
                >
                    <Input placeholder="user@example.com" />
                </Form.Item>
                <Form.Item
                    name="roles"
                    label="ロール"
                    rules={[
                        {
                            required: true,
                            message:
                                "最低1つのロールを指定してください",
                        },
                    ]}
                >
                    <Checkbox.Group
                        options={availableRoles.map((r) => ({
                            label: ROLE_LABELS[r],
                            value: r,
                        }))}
                        style={{ display: "flex", flexDirection: "column", gap: 8 }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
