"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    App,
    Typography,
    Card,
    Tag,
    Button,
    Space,
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    Popconfirm,
    Empty,
    Tooltip,
} from "antd";
import {
    PlusOutlined,
    ArrowLeftOutlined,
    EditOutlined,
    DeleteOutlined,
    ArrowRightOutlined,
    UndoOutlined,
    CheckOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { createTask, updateTask, changeTaskStatus, deleteTask } from "../_actions";
import { TASK_TRANSITIONS, type TaskStatus } from "@/types";

const { Title, Text, Paragraph } = Typography;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    todo: { label: "未着手", color: "default" },
    in_progress: { label: "進行中", color: "blue" },
    done: { label: "完了", color: "green" },
};

const COLUMN_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

type Task = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    assignee_id: string | null;
    due_date: string | null;
    project_id: string;
    created_by: string;
    created_at: string;
    updated_at: string;
};

type Project = {
    id: string;
    name: string;
    pm_id: string;
    status: string;
};

type Member = {
    user_id: string;
    display_name: string;
};

type Props = {
    project: Project;
    tasks: Task[];
    members: Member[];
    canManage: boolean;
    currentUserId: string;
};

export default function KanbanBoard({
    project,
    tasks,
    members,
    canManage,
    currentUserId,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { message } = App.useApp();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();

    const tasksByStatus: Record<string, Task[]> = {
        todo: tasks.filter((t) => t.status === "todo"),
        in_progress: tasks.filter((t) => t.status === "in_progress"),
        done: tasks.filter((t) => t.status === "done"),
    };

    const handleCreate = (values: { title: string; description?: string; assignee_id?: string; due_date?: unknown }) => {
        startTransition(async () => {
            const result = await createTask({
                project_id: project.id,
                title: values.title,
                description: values.description,
                assignee_id: values.assignee_id,
                due_date: values.due_date
                    ? (values.due_date as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : undefined,
            });
            if (result.success) {
                message.success("タスクを作成しました");
                setCreateModalOpen(false);
                createForm.resetFields();
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleUpdate = (values: { title: string; description?: string; assignee_id?: string | null; due_date?: unknown }) => {
        if (!editingTask) return;
        startTransition(async () => {
            const result = await updateTask({
                task_id: editingTask.id,
                title: values.title,
                description: values.description,
                assignee_id: values.assignee_id ?? null,
                due_date: values.due_date
                    ? (values.due_date as { format: (f: string) => string }).format("YYYY-MM-DD")
                    : null,
            });
            if (result.success) {
                message.success("タスクを更新しました");
                setEditingTask(null);
                editForm.resetFields();
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleStatusChange = (taskId: string, newStatus: string) => {
        startTransition(async () => {
            const result = await changeTaskStatus({
                task_id: taskId,
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

    const handleDelete = (taskId: string) => {
        startTransition(async () => {
            const result = await deleteTask({ task_id: taskId });
            if (result.success) {
                message.success("タスクを削除しました");
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    const canEditTask = (task: Task) => {
        return canManage || task.assignee_id === currentUserId;
    };

    const getStatusActions = (task: Task) => {
        const currentStatus = task.status as TaskStatus;
        const allowed = TASK_TRANSITIONS[currentStatus] || [];
        return allowed.map((targetStatus) => {
            const config = STATUS_CONFIG[targetStatus];
            let icon;
            if (targetStatus === "in_progress" && currentStatus === "todo") icon = <ArrowRightOutlined />;
            else if (targetStatus === "in_progress" && currentStatus === "done") icon = <ReloadOutlined />;
            else if (targetStatus === "done") icon = <CheckOutlined />;
            else if (targetStatus === "todo") icon = <UndoOutlined />;
            return { status: targetStatus, label: config.label, icon };
        });
    };

    const renderTaskCard = (task: Task) => {
        const canEdit = canEditTask(task);
        const actions = canEdit ? getStatusActions(task) : [];

        return (
            <Card
                key={task.id}
                size="small"
                style={{ marginBottom: 8 }}
                styles={{ body: { padding: "12px" } }}
            >
                <div style={{ marginBottom: 8 }}>
                    <Text strong>{task.title}</Text>
                </div>
                {task.description && (
                    <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ marginBottom: 8, fontSize: 12 }}
                    >
                        {task.description}
                    </Paragraph>
                )}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {task.assignee_id && (
                        <Tag color="blue" style={{ fontSize: 11 }}>
                            {members.find((m) => m.user_id === task.assignee_id)?.display_name ?? task.assignee_id.slice(0, 8) + "..."}
                        </Tag>
                    )}
                    {task.due_date && (
                        <Tag
                            color={
                                new Date(task.due_date) < new Date()
                                    ? "red"
                                    : "default"
                            }
                            style={{ fontSize: 11 }}
                        >
                            〆 {task.due_date}
                        </Tag>
                    )}
                </div>
                {canEdit && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Space size={4}>
                            {actions.map((a) => (
                                <Tooltip key={a.status} title={`${a.label}に変更`}>
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={a.icon}
                                        onClick={() => handleStatusChange(task.id, a.status)}
                                        loading={isPending}
                                    />
                                </Tooltip>
                            ))}
                        </Space>
                        <Space size={4}>
                            <Tooltip title="編集">
                                <Button
                                    size="small"
                                    type="text"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                        setEditingTask(task);
                                        editForm.setFieldsValue({
                                            title: task.title,
                                            description: task.description,
                                            assignee_id: task.assignee_id,
                                        });
                                    }}
                                />
                            </Tooltip>
                            {canManage && (
                                <Popconfirm
                                    title="このタスクを削除しますか？"
                                    onConfirm={() => handleDelete(task.id)}
                                    okText="削除"
                                    cancelText="キャンセル"
                                >
                                    <Tooltip title="削除">
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            loading={isPending}
                                        />
                                    </Tooltip>
                                </Popconfirm>
                            )}
                        </Space>
                    </div>
                )}
            </Card>
        );
    };

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => router.push(`/projects/${project.id}`)}
                >
                    プロジェクト詳細に戻る
                </Button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>
                    {project.name} — タスク管理
                </Title>
                {canManage && (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateModalOpen(true)}
                    >
                        新規タスク
                    </Button>
                )}
            </div>

            {/* カンバンボード */}
            <div style={{ display: "flex", gap: 16, minHeight: 400 }}>
                {COLUMN_ORDER.map((status) => {
                    const config = STATUS_CONFIG[status];
                    const columnTasks = tasksByStatus[status] || [];
                    return (
                        <div
                            key={status}
                            style={{
                                flex: 1,
                                background: "#fafafa",
                                borderRadius: 8,
                                padding: 12,
                                minWidth: 0,
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <Space>
                                    <Tag color={config.color}>{config.label}</Tag>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {columnTasks.length}件
                                    </Text>
                                </Space>
                            </div>
                            {columnTasks.length === 0 ? (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description="タスクなし"
                                    style={{ padding: "40px 0" }}
                                />
                            ) : (
                                columnTasks.map(renderTaskCard)
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 作成モーダル */}
            <Modal
                title="新規タスク作成"
                open={createModalOpen}
                forceRender
                onCancel={() => {
                    setCreateModalOpen(false);
                    createForm.resetFields();
                }}
                footer={null}
            >
                <Form form={createForm} layout="vertical" onFinish={handleCreate}>
                    <Form.Item
                        name="title"
                        label="タスク名"
                        rules={[
                            { required: true, message: "タスク名は必須です" },
                            { max: 200, message: "200文字以内で入力してください" },
                        ]}
                    >
                        <Input placeholder="タスク名を入力" />
                    </Form.Item>
                    <Form.Item name="description" label="説明">
                        <Input.TextArea rows={3} placeholder="説明を入力" />
                    </Form.Item>
                    <Form.Item name="assignee_id" label="担当者">
                        <Select placeholder="担当者を選択" allowClear>
                            {members.map((m) => (
                                <Select.Option key={m.user_id} value={m.user_id}>
                                    {m.display_name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="due_date" label="期限">
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={isPending}>
                                作成
                            </Button>
                            <Button onClick={() => { setCreateModalOpen(false); createForm.resetFields(); }}>
                                キャンセル
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 編集モーダル */}
            <Modal
                title="タスク編集"
                open={!!editingTask}
                forceRender
                onCancel={() => {
                    setEditingTask(null);
                    editForm.resetFields();
                }}
                footer={null}
            >
                <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
                    <Form.Item
                        name="title"
                        label="タスク名"
                        rules={[
                            { required: true, message: "タスク名は必須です" },
                            { max: 200, message: "200文字以内で入力してください" },
                        ]}
                    >
                        <Input placeholder="タスク名を入力" />
                    </Form.Item>
                    <Form.Item name="description" label="説明">
                        <Input.TextArea rows={3} placeholder="説明を入力" />
                    </Form.Item>
                    <Form.Item name="assignee_id" label="担当者">
                        <Select placeholder="担当者を選択" allowClear>
                            {members.map((m) => (
                                <Select.Option key={m.user_id} value={m.user_id}>
                                    {m.user_id.slice(0, 8)}...
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="due_date" label="期限">
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" loading={isPending}>
                                更新
                            </Button>
                            <Button onClick={() => { setEditingTask(null); editForm.resetFields(); }}>
                                キャンセル
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
