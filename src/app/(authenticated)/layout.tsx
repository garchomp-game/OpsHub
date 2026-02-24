import { requireAuth } from "@/lib/auth";
import { Layout, Menu, Typography, Avatar, Dropdown, Space } from "antd";
import {
    DashboardOutlined,
    ProjectOutlined,
    ClockCircleOutlined,
    FileTextOutlined,
    DollarOutlined,
    TeamOutlined,
    SettingOutlined,
    AuditOutlined,
    LogoutOutlined,
    UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import NotificationBell from "./_components/NotificationBell";
import {
    getNotifications,
    getUnreadCount,
} from "./_actions/notifications";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const sidebarItems = [
    {
        key: "dashboard",
        icon: <DashboardOutlined />,
        label: <Link href="/">ダッシュボード</Link>,
    },
    {
        key: "workflows",
        icon: <FileTextOutlined />,
        label: "ワークフロー",
        children: [
            { key: "wf-list", label: <Link href="/workflows">申請一覧</Link> },
            { key: "wf-pending", label: <Link href="/workflows/pending">承認待ち</Link> },
            { key: "wf-create", label: <Link href="/workflows/new">新規申請</Link> },
        ],
    },
    {
        key: "projects",
        icon: <ProjectOutlined />,
        label: <Link href="/projects">プロジェクト</Link>,
    },
    {
        key: "timesheets",
        icon: <ClockCircleOutlined />,
        label: "工数管理",
        children: [
            { key: "ts-entry", label: <Link href="/timesheets">工数入力</Link> },
            { key: "ts-reports", label: <Link href="/timesheets/reports">レポート</Link> },
        ],
    },
    {
        key: "expenses",
        icon: <DollarOutlined />,
        label: <Link href="/expenses">経費管理</Link>,
    },
    {
        key: "admin",
        icon: <SettingOutlined />,
        label: "管理",
        children: [
            { key: "admin-users", icon: <TeamOutlined />, label: <Link href="/admin/users">ユーザー管理</Link> },
            { key: "admin-tenant", icon: <SettingOutlined />, label: <Link href="/admin/tenant">テナント設定</Link> },
            { key: "admin-audit", icon: <AuditOutlined />, label: <Link href="/admin/audit-logs">監査ログ</Link> },
        ],
    },
];

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAuth();

    // 通知データの初期取得
    const [initialNotifications, initialUnreadCount] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
    ]);

    const userMenuItems = [
        {
            key: "profile",
            icon: <UserOutlined />,
            label: `${user.email}`,
            disabled: true,
        },
        { type: "divider" as const },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: <Link href="/auth/logout">ログアウト</Link>,
            danger: true,
        },
    ];

    return (
        <Layout style={{ minHeight: "100vh" }}>
            <Sider
                width={240}
                style={{
                    background: "#001529",
                    overflow: "auto",
                    height: "100vh",
                    position: "fixed",
                    left: 0,
                    top: 0,
                    bottom: 0,
                }}
            >
                <div
                    style={{
                        height: 64,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}
                >
                    <Text
                        strong
                        style={{ color: "#fff", fontSize: 18, letterSpacing: 1 }}
                    >
                        OpsHub
                    </Text>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    items={sidebarItems}
                    style={{ borderRight: 0 }}
                />
            </Sider>
            <Layout style={{ marginLeft: 240 }}>
                <Header
                    style={{
                        background: "#fff",
                        padding: "0 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                    }}
                >
                    <Space size="middle">
                        <NotificationBell
                            initialCount={initialUnreadCount}
                            initialNotifications={initialNotifications}
                        />
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <Avatar
                                icon={<UserOutlined />}
                                style={{ cursor: "pointer", backgroundColor: "#1677ff" }}
                            />
                        </Dropdown>
                    </Space>
                </Header>
                <Content style={{ margin: 24 }}>{children}</Content>
            </Layout>
        </Layout>
    );
}
