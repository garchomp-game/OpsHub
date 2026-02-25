"use client";

import { useState } from "react";
import {
    App,
    Drawer,
    Descriptions,
    Checkbox,
    Button,
    Space,
    Popconfirm,
    Tag,
    Divider,
    Typography,
} from "antd";
import {
    SaveOutlined,
    StopOutlined,
    CheckCircleOutlined,
    KeyOutlined,
} from "@ant-design/icons";
import {
    changeUserRoles,
    changeUserStatus,
    resetPassword,
    type TenantUser,
} from "../_actions";
import { ROLES, ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_COLORS } from "@/types";

const { Text } = Typography;

function RoleDiffDescription({
    currentRoles,
    newRoles,
}: {
    currentRoles: string[];
    newRoles: string[];
}) {
    const added = newRoles.filter((r) => !currentRoles.includes(r));
    const removed = currentRoles.filter((r) => !newRoles.includes(r));

    if (added.length === 0 && removed.length === 0) {
        return <Text type="secondary">変更はありません</Text>;
    }

    return (
        <div style={{ maxWidth: 280 }}>
            {removed.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                    <Text type="secondary">削除: </Text>
                    {removed.map((r) => (
                        <Tag key={r} color="red">
                            {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                        </Tag>
                    ))}
                </div>
            )}
            {added.length > 0 && (
                <div>
                    <Text type="secondary">追加: </Text>
                    {added.map((r) => (
                        <Tag key={r} color="green">
                            {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
                        </Tag>
                    ))}
                </div>
            )}
        </div>
    );
}

type Props = {
    user: TenantUser | null;
    open: boolean;
    onClose: () => void;
    onUpdate: () => void;
    tenantId: string;
    currentUserId: string;
    isItAdmin: boolean;
};



export default function UserDetailPanel({
    user,
    open,
    onClose,
    onUpdate,
    tenantId,
    currentUserId,
    isItAdmin,
}: Props) {
    const { message } = App.useApp();
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const isSelf = user?.id === currentUserId;

    // IT Admin でない場合は it_admin ロールを除外
    const availableRoles = ROLES.filter(
        (r) => isItAdmin || r !== "it_admin"
    );

    // Drawer 開閉で roles を同期
    const handleOpen = () => {
        if (user) {
            setSelectedRoles(user.roles);
        }
    };

    const handleSaveRoles = async () => {
        if (!user) return;
        setSaving(true);
        const result = await changeUserRoles({
            tenantId,
            userId: user.id,
            roles: selectedRoles,
        });
        if (result.success) {
            message.success("ロールを変更しました");
            onUpdate();
        } else {
            message.error(result.error.message);
        }
        setSaving(false);
    };

    const handleToggleStatus = async () => {
        if (!user) return;
        setSaving(true);
        const action = user.status === "disabled" ? "enable" : "disable";
        const result = await changeUserStatus({
            tenantId,
            userId: user.id,
            action,
        });
        if (result.success) {
            message.success(
                action === "disable"
                    ? "ユーザーを無効化しました"
                    : "ユーザーを再有効化しました"
            );
            onUpdate();
        } else {
            message.error(result.error.message);
        }
        setSaving(false);
    };

    const handleResetPassword = async () => {
        if (!user) return;
        setSaving(true);
        const result = await resetPassword({
            tenantId,
            userId: user.id,
            email: user.email,
        });
        if (result.success) {
            message.success("パスワードリセットメールを送信しました");
        } else {
            message.error(result.error.message);
        }
        setSaving(false);
    };

    if (!user) return null;

    return (
        <Drawer
            title="ユーザー詳細"
            open={open}
            onClose={onClose}
            width={480}
            afterOpenChange={(visible) => {
                if (visible) handleOpen();
            }}
        >
            <Descriptions column={1} bordered>
                <Descriptions.Item label="名前">
                    {user.name ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="メール">
                    {user.email}
                </Descriptions.Item>
                <Descriptions.Item label="ステータス">
                    <Tag color={USER_STATUS_COLORS[user.status as keyof typeof USER_STATUS_COLORS]}>
                        {USER_STATUS_LABELS[user.status as keyof typeof USER_STATUS_LABELS]}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="最終ログイン">
                    {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString(
                            "ja-JP"
                        )
                        : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="登録日">
                    {new Date(user.created_at).toLocaleDateString("ja-JP")}
                </Descriptions.Item>
            </Descriptions>

            <Divider>ロール</Divider>

            {isSelf ? (
                <div>
                    <Text type="secondary">
                        自分のロールは変更できません
                    </Text>
                    <div style={{ marginTop: 8 }}>
                        {user.roles.map((r) => (
                            <Tag key={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</Tag>
                        ))}
                    </div>
                </div>
            ) : (
                <div>
                    <Checkbox.Group
                        value={selectedRoles}
                        onChange={(values) =>
                            setSelectedRoles(values as string[])
                        }
                        options={availableRoles.map((r) => ({
                            label: ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r,
                            value: r,
                        }))}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    />
                    <Popconfirm
                        title={`${user.name ?? user.email} のロールを変更しますか？この操作は監査ログに記録されます。`}
                        description={
                            <RoleDiffDescription
                                currentRoles={user.roles}
                                newRoles={selectedRoles}
                            />
                        }
                        onConfirm={handleSaveRoles}
                        okText="変更する"
                        cancelText="キャンセル"
                    >
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={saving}
                            disabled={selectedRoles.length === 0}
                            style={{ marginTop: 16 }}
                        >
                            ロール変更を保存
                        </Button>
                    </Popconfirm>
                </div>
            )}

            <Divider>操作</Divider>

            <Space direction="vertical" style={{ width: "100%" }}>
                <Popconfirm
                    title="パスワードリセットメールを送信しますか？"
                    onConfirm={handleResetPassword}
                    okText="送信"
                    cancelText="キャンセル"
                >
                    <Button icon={<KeyOutlined />} block>
                        パスワードリセット
                    </Button>
                </Popconfirm>

                {!isSelf && (
                    <Popconfirm
                        title={
                            user.status === "disabled"
                                ? "ユーザーを再有効化しますか？"
                                : "ユーザーを無効化しますか？この操作によりユーザーはログインできなくなります。"
                        }
                        onConfirm={handleToggleStatus}
                        okText={
                            user.status === "disabled"
                                ? "再有効化"
                                : "無効化"
                        }
                        cancelText="キャンセル"
                        okButtonProps={{
                            danger: user.status !== "disabled",
                        }}
                    >
                        <Button
                            danger={user.status !== "disabled"}
                            icon={
                                user.status === "disabled" ? (
                                    <CheckCircleOutlined />
                                ) : (
                                    <StopOutlined />
                                )
                            }
                            block
                        >
                            {user.status === "disabled"
                                ? "再有効化"
                                : "無効化"}
                        </Button>
                    </Popconfirm>
                )}
            </Space>
        </Drawer>
    );
}
