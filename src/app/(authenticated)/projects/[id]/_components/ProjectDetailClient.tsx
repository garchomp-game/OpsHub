"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Typography,
    Tabs,
    Card,
    Descriptions,
    Tag,
    Button,
    Space,
    Select,
    Table,
    Popconfirm,
    Statistic,
    Row,
    Col,
    message,
    Modal,
    Input,
} from "antd";
import {
    EditOutlined,
    UserAddOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    FileOutlined,
} from "@ant-design/icons";
import { updateProject, addMember, removeMember } from "../../_actions";
import type { ProjectStatus } from "@/types";
import { PROJECT_TRANSITIONS } from "@/types";

const { Title, Text } = Typography;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    planning: { label: "計画中", color: "blue" },
    active: { label: "進行中", color: "green" },
    completed: { label: "完了", color: "default" },
    cancelled: { label: "中止", color: "red" },
};

type Project = {
    id: string;
    name: string;
    description: string | null;
    status: string;
    pm_id: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
};

type Member = {
    id: string;
    user_id: string;
    created_at: string;
    display_name: string;
};

type TenantUser = {
    user_id: string;
    role: string;
    display_name: string;
};

type TaskStats = {
    total: number;
    todo: number;
    in_progress: number;
    done: number;
};

type Props = {
    project: Project;
    members: Member[];
    taskStats: TaskStats;
    tenantUsers: TenantUser[];
    canEdit: boolean;
    currentUserId: string;
    pmDisplayName: string;
};

export default function ProjectDetailClient({
    project,
    members,
    taskStats,
    tenantUsers,
    canEdit,
    currentUserId,
    pmDisplayName,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(project.name);
    const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    const currentStatus = project.status as ProjectStatus;
    const possibleTransitions = PROJECT_TRANSITIONS[currentStatus] || [];

    const handleStatusChange = (newStatus: string) => {
        startTransition(async () => {
            const result = await updateProject({
                project_id: project.id,
                status: newStatus,
            });
            if (result.success) {
                message.success("ステータスを変更しました");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleNameSave = () => {
        startTransition(async () => {
            const result = await updateProject({
                project_id: project.id,
                name: nameValue,
            });
            if (result.success) {
                message.success("プロジェクト名を更新しました");
                setEditingName(false);
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleAddMember = () => {
        if (!selectedUserId) return;
        startTransition(async () => {
            const result = await addMember({
                project_id: project.id,
                user_id: selectedUserId,
            });
            if (result.success) {
                message.success("メンバーを追加しました");
                setAddMemberModalOpen(false);
                setSelectedUserId("");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleRemoveMember = (userId: string) => {
        startTransition(async () => {
            const result = await removeMember({
                project_id: project.id,
                user_id: userId,
            });
            if (result.success) {
                message.success("メンバーを削除しました");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const memberIds = new Set(members.map((m) => m.user_id));
    const nonMembers = tenantUsers.filter((u) => !memberIds.has(u.user_id));

    const statusInfo = STATUS_LABELS[project.status] || { label: project.status, color: "default" };

    const overviewTab = (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Descriptions
                    title={
                        editingName ? (
                            <Space>
                                <Input
                                    value={nameValue}
                                    onChange={(e) => setNameValue(e.target.value)}
                                    style={{ width: 300 }}
                                />
                                <Button type="primary" size="small" onClick={handleNameSave} loading={isPending}>
                                    保存
                                </Button>
                                <Button size="small" onClick={() => { setEditingName(false); setNameValue(project.name); }}>
                                    取消
                                </Button>
                            </Space>
                        ) : (
                            <Space>
                                {project.name}
                                {canEdit && (
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => setEditingName(true)}
                                    />
                                )}
                            </Space>
                        )
                    }
                    bordered
                    column={2}
                >
                    <Descriptions.Item label="ステータス">
                        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="PM">{pmDisplayName}</Descriptions.Item>
                    <Descriptions.Item label="開始日">{project.start_date || "—"}</Descriptions.Item>
                    <Descriptions.Item label="終了日">{project.end_date || "—"}</Descriptions.Item>
                    <Descriptions.Item label="説明" span={2}>
                        {project.description || "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="作成日">
                        {new Date(project.created_at).toLocaleDateString("ja-JP")}
                    </Descriptions.Item>
                    <Descriptions.Item label="更新日">
                        {new Date(project.updated_at).toLocaleDateString("ja-JP")}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {canEdit && possibleTransitions.length > 0 && (
                <Card title="ステータス変更" style={{ marginBottom: 16 }}>
                    <Space>
                        {possibleTransitions.map((status) => {
                            const s = STATUS_LABELS[status] || { label: status, color: "default" };
                            return (
                                <Popconfirm
                                    key={status}
                                    title={`ステータスを「${s.label}」に変更しますか？`}
                                    onConfirm={() => handleStatusChange(status)}
                                    okText="変更"
                                    cancelText="キャンセル"
                                >
                                    <Button loading={isPending}>
                                        {s.label}に変更
                                    </Button>
                                </Popconfirm>
                            );
                        })}
                    </Space>
                </Card>
            )}

            <Row gutter={16}>
                <Col span={6}>
                    <Card>
                        <Statistic title="タスク合計" value={taskStats.total} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic title="未着手" value={taskStats.todo} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic title="進行中" value={taskStats.in_progress} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="完了"
                            value={taskStats.done}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );

    const memberColumns = [
        {
            title: "ユーザー",
            dataIndex: "display_name",
            key: "display_name",
        },
        {
            title: "ロール",
            key: "role",
            render: (_: unknown, record: Member) => {
                if (record.user_id === project.pm_id) return <Tag color="gold">PM</Tag>;
                return <Tag>メンバー</Tag>;
            },
        },
        {
            title: "参加日",
            dataIndex: "created_at",
            key: "created_at",
            render: (d: string) => new Date(d).toLocaleDateString("ja-JP"),
        },
        ...(canEdit
            ? [
                {
                    title: "操作",
                    key: "actions",
                    render: (_: unknown, record: Member) => {
                        if (record.user_id === project.pm_id) return <Text type="secondary">PM</Text>;
                        return (
                            <Popconfirm
                                title="このメンバーを削除しますか？"
                                onConfirm={() => handleRemoveMember(record.user_id)}
                                okText="削除"
                                cancelText="キャンセル"
                            >
                                <Button danger size="small" icon={<DeleteOutlined />}>
                                    削除
                                </Button>
                            </Popconfirm>
                        );
                    },
                },
            ]
            : []),
    ];

    const membersTab = (
        <div>
            {canEdit && (
                <div style={{ marginBottom: 16 }}>
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => setAddMemberModalOpen(true)}
                    >
                        メンバー追加
                    </Button>
                </div>
            )}
            <Table dataSource={members} columns={memberColumns} rowKey="id" pagination={false} />

            <Modal
                title="メンバー追加"
                open={addMemberModalOpen}
                onOk={handleAddMember}
                onCancel={() => {
                    setAddMemberModalOpen(false);
                    setSelectedUserId("");
                }}
                confirmLoading={isPending}
                okText="追加"
                cancelText="キャンセル"
            >
                <Select
                    placeholder="ユーザーを選択"
                    style={{ width: "100%" }}
                    value={selectedUserId || undefined}
                    onChange={setSelectedUserId}
                >
                    {nonMembers.map((u) => (
                        <Select.Option key={u.user_id} value={u.user_id}>
                            {u.display_name}（{u.role}）
                        </Select.Option>
                    ))}
                </Select>
            </Modal>
        </div>
    );

    const tasksTab = (
        <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
                <Text>タスクの管理はカンバンボードで行えます。</Text>
                <Button type="primary" onClick={() => router.push(`/projects/${project.id}/tasks`)}>
                    カンバンボードを開く
                </Button>
            </Space>
        </Card>
    );

    const timesheetsTab = (
        <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
                <Text>工数の入力は工数管理画面で行えます。</Text>
                <Button type="primary" onClick={() => router.push("/timesheets")}>
                    工数入力画面を開く
                </Button>
            </Space>
        </Card>
    );

    const documentsTab = (
        <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
                <Text>プロジェクトに関連するドキュメントを管理できます。</Text>
                <Button type="primary" icon={<FileOutlined />} onClick={() => router.push(`/projects/${project.id}/documents`)}>
                    ドキュメント管理を開く
                </Button>
            </Space>
        </Card>
    );

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button onClick={() => router.push("/projects")}>← プロジェクト一覧</Button>
            </div>

            <Tabs
                defaultActiveKey="overview"
                items={[
                    { key: "overview", label: "概要", children: overviewTab },
                    { key: "members", label: `メンバー (${members.length})`, children: membersTab },
                    { key: "tasks", label: `タスク (${taskStats.total})`, children: tasksTab },
                    { key: "timesheets", label: "工数", children: timesheetsTab },
                    { key: "documents", label: "ドキュメント", children: documentsTab },
                ]}
            />
        </div>
    );
}
