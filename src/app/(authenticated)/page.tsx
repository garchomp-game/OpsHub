import { requireAuth, hasRole } from "@/lib/auth";
import { Row, Col, Card, Statistic, List, Button, Typography, Space, Progress, Empty } from "antd";
import {
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ProjectOutlined,
    PlusOutlined,
    BellOutlined,
    RightOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import {
    getPendingApprovalsCount,
    getMyWorkflowsCount,
    getMyTasksCount,
    getWeeklyHours,
    getProjectProgress,
    getUnreadNotifications,
} from "./_actions/dashboard";
import type { Role } from "@/types";
import type { NotificationRow } from "./_actions/dashboard";

const { Title, Text } = Typography;

/** 通知の resource_type / resource_id からリンク先URLを生成する */
function getNotificationHref(notification: NotificationRow): string | null {
    const { resource_type, resource_id } = notification;
    if (!resource_type || !resource_id) return null;

    const routes: Record<string, string> = {
        workflow: `/workflows/${resource_id}`,
        task: `/tasks/${resource_id}`,
        project: `/projects/${resource_id}`,
        expense: `/expenses/${resource_id}`,
    };

    return routes[resource_type] ?? null;
}

export default async function DashboardPage() {
    const user = await requireAuth();
    const tenantId = user.tenantIds[0];

    // ─── ロール判定 ──────────────────────────────────
    const isApprover = tenantId && hasRole(user, tenantId, ["approver", "tenant_admin"]);
    const isMemberOrPm = tenantId && hasRole(user, tenantId, ["member", "pm"]);
    const isPm = tenantId && hasRole(user, tenantId, ["pm"]);

    // ─── データ並行取得 ──────────────────────────────
    const [
        pendingApprovals,
        myWorkflows,
        myTasks,
        weeklyHours,
        projectProgress,
        unreadNotifications,
    ] = await Promise.all([
        isApprover ? getPendingApprovalsCount() : Promise.resolve(0),
        getMyWorkflowsCount(),
        isMemberOrPm ? getMyTasksCount() : Promise.resolve(0),
        isMemberOrPm ? getWeeklyHours() : Promise.resolve(0),
        isPm ? getProjectProgress() : Promise.resolve([]),
        getUnreadNotifications(),
    ]);

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                ダッシュボード
            </Title>

            {/* ─── KPIカード ─────────────────────────────── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {/* 自分の申請: 全ロール */}
                <Col xs={24} sm={12} lg={6}>
                    <Card hoverable>
                        <Statistic
                            title="自分の申請"
                            value={myWorkflows}
                            prefix={<FileTextOutlined />}
                            suffix="件"
                        />
                    </Card>
                </Col>

                {/* 未処理の申請: 承認者 / テナント管理者 */}
                {isApprover && (
                    <Col xs={24} sm={12} lg={6}>
                        <Card hoverable>
                            <Statistic
                                title="未処理の申請"
                                value={pendingApprovals}
                                prefix={<CheckCircleOutlined />}
                                suffix="件"
                                valueStyle={pendingApprovals > 0 ? { color: "#cf1322" } : undefined}
                            />
                        </Card>
                    </Col>
                )}

                {/* 担当タスク: メンバー / PM */}
                {isMemberOrPm && (
                    <Col xs={24} sm={12} lg={6}>
                        <Card hoverable>
                            <Statistic
                                title="担当タスク"
                                value={myTasks}
                                prefix={<ProjectOutlined />}
                                suffix="件"
                            />
                        </Card>
                    </Col>
                )}

                {/* 今週の工数: メンバー / PM */}
                {isMemberOrPm && (
                    <Col xs={24} sm={12} lg={6}>
                        <Card hoverable>
                            <Statistic
                                title="今週の工数"
                                value={weeklyHours}
                                prefix={<ClockCircleOutlined />}
                                suffix="h"
                                precision={1}
                            />
                        </Card>
                    </Col>
                )}
            </Row>

            {/* ─── プロジェクト進捗: PM のみ ─────────────── */}
            {isPm && projectProgress.length > 0 && (
                <Card
                    title="プロジェクト進捗"
                    style={{ marginBottom: 24 }}
                    extra={<Link href="/projects">一覧 <RightOutlined /></Link>}
                >
                    <Row gutter={[16, 16]}>
                        {projectProgress.map((pj) => (
                            <Col xs={24} sm={12} lg={8} key={pj.name}>
                                <Text strong>{pj.name}</Text>
                                <Progress percent={pj.progress} size="small" style={{ marginTop: 8 }} />
                            </Col>
                        ))}
                    </Row>
                </Card>
            )}

            <Row gutter={[16, 16]}>
                {/* ─── 通知セクション ─────────────────────── */}
                <Col xs={24} lg={14}>
                    <Card
                        title={
                            <Space>
                                <BellOutlined />
                                未読通知
                            </Space>
                        }
                        extra={<Link href="/notifications">すべて見る</Link>}
                    >
                        {unreadNotifications.length > 0 ? (
                            <List
                                dataSource={unreadNotifications}
                                renderItem={(item) => {
                                    const href = getNotificationHref(item);
                                    const content = (
                                        <List.Item style={href ? { cursor: "pointer" } : undefined}>
                                            <List.Item.Meta
                                                title={href ? <Link href={href}>{item.title}</Link> : item.title}
                                                description={
                                                    <Space direction="vertical" size={0}>
                                                        {item.body && <Text type="secondary">{item.body}</Text>}
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            {new Date(item.created_at).toLocaleString("ja-JP")}
                                                        </Text>
                                                    </Space>
                                                }
                                            />
                                        </List.Item>
                                    );
                                    return content;
                                }}
                            />
                        ) : (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="未読の通知はありません"
                            />
                        )}
                    </Card>
                </Col>

                {/* ─── クイックアクション ─────────────────── */}
                <Col xs={24} lg={10}>
                    <Card title="クイックアクション">
                        <Space direction="vertical" style={{ width: "100%" }} size="middle">
                            <Link href="/workflows/new" style={{ display: "block" }}>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    block
                                    size="large"
                                >
                                    新規申請
                                </Button>
                            </Link>
                            <Link href="/timesheets" style={{ display: "block" }}>
                                <Button
                                    icon={<ClockCircleOutlined />}
                                    block
                                    size="large"
                                >
                                    工数を入力
                                </Button>
                            </Link>
                            <Link href="/projects" style={{ display: "block" }}>
                                <Button
                                    icon={<ProjectOutlined />}
                                    block
                                    size="large"
                                >
                                    プロジェクト一覧
                                </Button>
                            </Link>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
