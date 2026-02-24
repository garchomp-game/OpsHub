"use client";

import { useState, useTransition } from "react";
import { Badge, Popover, List, Button, Typography, Empty, Tooltip, Space } from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import {
    markAsRead,
    markAllAsRead,
    getNotifications,
    getUnreadCount,
    type NotificationRow,
} from "@/app/(authenticated)/_actions/notifications";
import { getNotificationLink } from "@/lib/notifications";
import { useRouter } from "next/navigation";

const { Text } = Typography;

interface NotificationBellProps {
    initialCount: number;
    initialNotifications: NotificationRow[];
}

export default function NotificationBell({
    initialCount,
    initialNotifications,
}: NotificationBellProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState(initialCount);
    const [notifications, setNotifications] = useState(initialNotifications);
    const [isPending, startTransition] = useTransition();

    // ドロップダウンを開いた時にデータを最新化
    const handleOpenChange = (visible: boolean) => {
        setOpen(visible);
        if (visible) {
            startTransition(async () => {
                const [freshNotifications, freshCount] = await Promise.all([
                    getNotifications(),
                    getUnreadCount(),
                ]);
                setNotifications(freshNotifications);
                setCount(freshCount);
            });
        }
    };

    // 個別の通知をクリック → 既読にしてリソースページへ遷移
    const handleClick = (notification: NotificationRow) => {
        startTransition(async () => {
            if (!notification.is_read) {
                await markAsRead(notification.id);
                setCount((prev) => Math.max(0, prev - 1));
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, is_read: true } : n
                    )
                );
            }

            const link = getNotificationLink(
                notification.resource_type,
                notification.resource_id
            );
            if (link) {
                setOpen(false);
                router.push(link);
            }
        });
    };

    // すべて既読にする
    const handleMarkAllAsRead = () => {
        startTransition(async () => {
            await markAllAsRead();
            setCount(0);
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true }))
            );
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60_000);
        const diffHour = Math.floor(diffMs / 3_600_000);
        const diffDay = Math.floor(diffMs / 86_400_000);

        if (diffMin < 1) return "たった今";
        if (diffMin < 60) return `${diffMin}分前`;
        if (diffHour < 24) return `${diffHour}時間前`;
        if (diffDay < 7) return `${diffDay}日前`;
        return date.toLocaleDateString("ja-JP");
    };

    const content = (
        <div style={{ width: 360 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: "1px solid #f0f0f0",
                }}
            >
                <Text strong>通知</Text>
                {count > 0 && (
                    <Button
                        type="link"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={handleMarkAllAsRead}
                        loading={isPending}
                    >
                        すべて既読にする
                    </Button>
                )}
            </div>
            {notifications.length === 0 ? (
                <Empty
                    description="通知はありません"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: "24px 0" }}
                />
            ) : (
                <List
                    dataSource={notifications}
                    style={{ maxHeight: 400, overflowY: "auto" }}
                    renderItem={(item) => (
                        <List.Item
                            onClick={() => handleClick(item)}
                            style={{
                                cursor: "pointer",
                                padding: "10px 12px",
                                background: item.is_read
                                    ? "transparent"
                                    : "rgba(22,119,255,0.04)",
                                transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                    "rgba(0,0,0,0.04)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = item.is_read
                                    ? "transparent"
                                    : "rgba(22,119,255,0.04)";
                            }}
                        >
                            <List.Item.Meta
                                title={
                                    <Space size={4}>
                                        {!item.is_read && (
                                            <Badge
                                                status="processing"
                                                style={{ marginRight: 4 }}
                                            />
                                        )}
                                        <Text
                                            style={{
                                                fontWeight: item.is_read
                                                    ? "normal"
                                                    : 600,
                                                fontSize: 13,
                                            }}
                                        >
                                            {item.title}
                                        </Text>
                                    </Space>
                                }
                                description={
                                    <div>
                                        {item.body && (
                                            <Text
                                                type="secondary"
                                                style={{
                                                    fontSize: 12,
                                                    display: "block",
                                                    marginBottom: 2,
                                                }}
                                                ellipsis
                                            >
                                                {item.body}
                                            </Text>
                                        )}
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: 11 }}
                                        >
                                            {formatDate(item.created_at)}
                                        </Text>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            open={open}
            onOpenChange={handleOpenChange}
            placement="bottomRight"
            arrow={false}
        >
            <Tooltip title="通知">
                <Badge count={count} size="small" offset={[-2, 2]}>
                    <BellOutlined
                        style={{ fontSize: 18, cursor: "pointer" }}
                    />
                </Badge>
            </Tooltip>
        </Popover>
    );
}
