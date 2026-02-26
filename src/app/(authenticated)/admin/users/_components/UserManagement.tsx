"use client";

import { useState, useEffect } from "react";
import {
    App,
    Table,
    Input,
    Select,
    Button,
    Tag,
    Space,
    Typography,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import type { TableProps } from "antd";
import { getUsers, type TenantUser } from "../_actions";
import { ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_COLORS } from "@/types";
import InviteModal from "./InviteModal";
import UserDetailPanel from "./UserDetailPanel";

const { Title } = Typography;
const { Search } = Input;

type Props = {
    tenantId: string;
    currentUserId: string;
    isItAdmin: boolean;
};



export default function UserManagement({
    tenantId,
    currentUserId,
    isItAdmin,
}: Props) {
    const { message } = App.useApp();
    const [users, setUsers] = useState<TenantUser[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<TenantUser | null>(
        null
    );
    const [detailOpen, setDetailOpen] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        const result = await getUsers({
            tenantId,
            search,
            roleFilter,
            statusFilter,
            page,
            perPage: 25,
        });
        if (result.success) {
            setUsers(result.data.data);
            setTotal(result.data.count);
        } else {
            message.error(result.error.message);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers(); // eslint-disable-line react-hooks/set-state-in-effect
    }, [tenantId, search, roleFilter, statusFilter, page, message]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRowClick = (user: TenantUser) => {
        setSelectedUser(user);
        setDetailOpen(true);
    };

    const columns: TableProps<TenantUser>["columns"] = [
        {
            title: "状態",
            dataIndex: "status",
            key: "status",
            width: 80,
            render: (status: string) => (
                <Tag color={USER_STATUS_COLORS[status as keyof typeof USER_STATUS_COLORS]}>
                    {USER_STATUS_LABELS[status as keyof typeof USER_STATUS_LABELS]}
                </Tag>
            ),
        },
        {
            title: "名前",
            dataIndex: "name",
            key: "name",
            sorter: (a, b) =>
                (a.name ?? "").localeCompare(b.name ?? ""),
            render: (name: string | null) => name ?? "—",
        },
        {
            title: "メールアドレス",
            dataIndex: "email",
            key: "email",
            sorter: (a, b) => a.email.localeCompare(b.email),
        },
        {
            title: "ロール",
            dataIndex: "roles",
            key: "roles",
            render: (roles: string[]) => (
                <Space wrap>
                    {roles.map((r) => (
                        <Tag key={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: "最終ログイン",
            dataIndex: "last_sign_in_at",
            key: "last_sign_in_at",
            sorter: (a, b) =>
                (a.last_sign_in_at ?? "").localeCompare(
                    b.last_sign_in_at ?? ""
                ),
            render: (date: string | null) =>
                date
                    ? new Date(date).toLocaleString("ja-JP")
                    : "—",
        },
    ];

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    ユーザー管理
                </Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setInviteOpen(true)}
                >
                    ユーザー招待
                </Button>
            </div>

            <Space
                style={{ marginBottom: 16, width: "100%" }}
                wrap
            >
                <Search
                    placeholder="名前・メールで検索"
                    onSearch={(value) => {
                        setSearch(value);
                        setPage(1);
                    }}
                    style={{ width: 280 }}
                    allowClear
                />
                <Select
                    value={roleFilter}
                    onChange={(value) => {
                        setRoleFilter(value);
                        setPage(1);
                    }}
                    style={{ width: 160 }}
                    options={[
                        { label: "全ロール", value: "all" },
                        { label: "メンバー", value: "member" },
                        { label: "承認者", value: "approver" },
                        { label: "PM", value: "pm" },
                        { label: "経理", value: "accounting" },
                        {
                            label: "テナント管理者",
                            value: "tenant_admin",
                        },
                        { label: "IT管理者", value: "it_admin" },
                    ]}
                />
                <Select
                    value={statusFilter}
                    onChange={(value) => {
                        setStatusFilter(value);
                        setPage(1);
                    }}
                    style={{ width: 120 }}
                    options={[
                        { label: "全状態", value: "all" },
                        { label: "有効", value: "active" },
                        { label: "招待中", value: "invited" },
                        { label: "無効", value: "disabled" },
                    ]}
                />
                <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchUsers}
                >
                    更新
                </Button>
            </Space>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    total,
                    pageSize: 25,
                    onChange: (p) => setPage(p),
                    showTotal: (total, range) =>
                        `${range[0]}-${range[1]} / ${total}件`,
                }}
                onRow={(record) => ({
                    onClick: () => handleRowClick(record),
                    style: { cursor: "pointer" },
                })}
            />

            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                onSuccess={fetchUsers}
                tenantId={tenantId}
                isItAdmin={isItAdmin}
            />

            <UserDetailPanel
                user={selectedUser}
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                onUpdate={() => {
                    fetchUsers();
                    setDetailOpen(false);
                }}
                tenantId={tenantId}
                currentUserId={currentUserId}
                isItAdmin={isItAdmin}
            />
        </div>
    );
}
