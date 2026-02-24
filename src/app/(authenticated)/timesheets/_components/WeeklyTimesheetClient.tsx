"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Typography,
    Card,
    Button,
    Space,
    InputNumber,
    Select,
    Table,
    message,
    Tag,
    Popconfirm,
} from "antd";
import {
    LeftOutlined,
    RightOutlined,
    PlusOutlined,
    SaveOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import { bulkUpdateTimesheets, deleteTimesheet } from "../_actions";

const { Title, Text } = Typography;

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

type Timesheet = {
    id: string;
    project_id: string;
    task_id: string | null;
    work_date: string;
    hours: number;
    note: string | null;
};

type Project = {
    id: string;
    name: string;
    status: string;
};

type Task = {
    id: string;
    title: string;
    project_id: string;
    status: string;
};

type RowData = {
    key: string;
    project_id: string;
    task_id: string | null;
    hours: Record<string, number>;
    ids: Record<string, string>;
};

type Props = {
    weekStart: string;
    weekDates: string[];
    timesheets: Timesheet[];
    projects: Project[];
    tasks: Task[];
};

export default function WeeklyTimesheetClient({
    weekStart,
    weekDates,
    timesheets,
    projects,
    tasks,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // 既存データから行データを構築
    const initialRows = useMemo(() => {
        const rowMap = new Map<string, RowData>();
        for (const ts of timesheets) {
            const key = `${ts.project_id}::${ts.task_id || ""}`;
            if (!rowMap.has(key)) {
                rowMap.set(key, {
                    key,
                    project_id: ts.project_id,
                    task_id: ts.task_id,
                    hours: {},
                    ids: {},
                });
            }
            const row = rowMap.get(key)!;
            row.hours[ts.work_date] = Number(ts.hours);
            row.ids[ts.work_date] = ts.id;
        }
        return Array.from(rowMap.values());
    }, [timesheets]);

    const [rows, setRows] = useState<RowData[]>(initialRows);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);

    const navigateWeek = (direction: number) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + direction * 7);
        const newWeek = d.toISOString().split("T")[0];
        router.push(`/timesheets?week=${newWeek}`);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const weekEndDate = weekDates[6];
    const weekLabel = `${formatDate(weekStart)} 〜 ${formatDate(weekEndDate)}`;

    const addRow = () => {
        if (projects.length === 0) {
            message.warning("所属プロジェクトがありません");
            return;
        }
        const newRow: RowData = {
            key: `new-${Date.now()}`,
            project_id: projects[0].id,
            task_id: null,
            hours: {},
            ids: {},
        };
        setRows([...rows, newRow]);
    };

    const updateRowProject = (rowKey: string, projectId: string) => {
        setRows(rows.map((r) =>
            r.key === rowKey ? { ...r, project_id: projectId, task_id: null } : r
        ));
    };

    const updateRowTask = (rowKey: string, taskId: string | null) => {
        setRows(rows.map((r) =>
            r.key === rowKey ? { ...r, task_id: taskId } : r
        ));
    };

    const updateHours = (rowKey: string, date: string, hours: number | null) => {
        setRows(rows.map((r) => {
            if (r.key !== rowKey) return r;
            const newHours = { ...r.hours };
            if (hours === null || hours === 0) {
                delete newHours[date];
                // 既存IDがあれば削除リストに追加
                if (r.ids[date]) {
                    setDeletedIds((prev) => [...prev, r.ids[date]]);
                }
            } else {
                newHours[date] = hours;
            }
            return { ...r, hours: newHours };
        }));
    };

    const removeRow = (rowKey: string) => {
        const row = rows.find((r) => r.key === rowKey);
        if (row) {
            const idsToDelete = Object.values(row.ids).filter(Boolean);
            setDeletedIds((prev) => [...prev, ...idsToDelete]);
        }
        setRows(rows.filter((r) => r.key !== rowKey));
    };

    const handleSave = () => {
        startTransition(async () => {
            const entries = rows.flatMap((row) =>
                Object.entries(row.hours)
                    .filter(([, h]) => h > 0)
                    .map(([date, hours]) => ({
                        id: row.ids[date] || undefined,
                        project_id: row.project_id,
                        task_id: row.task_id || undefined,
                        work_date: date,
                        hours,
                    }))
            );

            const result = await bulkUpdateTimesheets({
                entries,
                deleted_ids: deletedIds.length > 0 ? deletedIds : undefined,
            });

            if (result.success) {
                message.success("工数を保存しました");
                setDeletedIds([]);
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        });
    };

    // 日別合計計算
    const dailyTotals: Record<string, number> = {};
    for (const date of weekDates) {
        dailyTotals[date] = rows.reduce((sum, row) => sum + (row.hours[date] || 0), 0);
    }
    const weekTotal = Object.values(dailyTotals).reduce((sum, h) => sum + h, 0);

    // 行別合計計算
    const rowTotals: Record<string, number> = {};
    for (const row of rows) {
        rowTotals[row.key] = Object.values(row.hours).reduce((sum, h) => sum + h, 0);
    }

    const projectTaskMap = useMemo(() => {
        const map: Record<string, Task[]> = {};
        for (const task of tasks) {
            if (!map[task.project_id]) map[task.project_id] = [];
            map[task.project_id].push(task);
        }
        return map;
    }, [tasks]);

    const columns = [
        {
            title: "プロジェクト",
            key: "project",
            width: 180,
            render: (_: unknown, record: RowData) => (
                <Select
                    size="small"
                    value={record.project_id}
                    onChange={(v) => updateRowProject(record.key, v)}
                    style={{ width: "100%" }}
                >
                    {projects.map((p) => (
                        <Select.Option key={p.id} value={p.id}>
                            {p.name}
                        </Select.Option>
                    ))}
                </Select>
            ),
        },
        {
            title: "タスク",
            key: "task",
            width: 160,
            render: (_: unknown, record: RowData) => {
                const projectTasks = projectTaskMap[record.project_id] || [];
                return (
                    <Select
                        size="small"
                        value={record.task_id || undefined}
                        onChange={(v) => updateRowTask(record.key, v || null)}
                        style={{ width: "100%" }}
                        allowClear
                        placeholder="なし"
                    >
                        {projectTasks.map((t) => (
                            <Select.Option key={t.id} value={t.id}>
                                {t.title}
                            </Select.Option>
                        ))}
                    </Select>
                );
            },
        },
        ...weekDates.map((date, idx) => ({
            title: (
                <div style={{ textAlign: "center" as const }}>
                    <div style={{ fontSize: 11, color: idx >= 5 ? "#ff4d4f" : undefined }}>
                        {DAY_LABELS[idx]}
                    </div>
                    <div style={{ fontSize: 11 }}>{formatDate(date)}</div>
                </div>
            ),
            key: date,
            width: 80,
            render: (_: unknown, record: RowData) => (
                <InputNumber
                    size="small"
                    min={0}
                    max={24}
                    step={0.25}
                    value={record.hours[date] || null}
                    onChange={(v) => updateHours(record.key, date, v)}
                    style={{ width: "100%" }}
                    placeholder="0"
                />
            ),
        })),
        {
            title: "合計",
            key: "total",
            width: 70,
            render: (_: unknown, record: RowData) => (
                <Text strong>{(rowTotals[record.key] || 0).toFixed(2)}</Text>
            ),
        },
        {
            title: "",
            key: "actions",
            width: 40,
            render: (_: unknown, record: RowData) => (
                <Popconfirm
                    title="この行を削除しますか？"
                    onConfirm={() => removeRow(record.key)}
                    okText="削除"
                    cancelText="キャンセル"
                >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>工数入力</Title>
                <Space>
                    <Button
                        icon={<PlusOutlined />}
                        onClick={addRow}
                    >
                        行追加
                    </Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSave}
                        loading={isPending}
                    >
                        保存
                    </Button>
                </Space>
            </div>

            {/* 週ナビゲーション */}
            <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
                    <Button
                        icon={<LeftOutlined />}
                        onClick={() => navigateWeek(-1)}
                    >
                        前週
                    </Button>
                    <Title level={4} style={{ margin: 0 }}>{weekLabel}</Title>
                    <Button
                        onClick={() => navigateWeek(1)}
                    >
                        翌週
                        <RightOutlined />
                    </Button>
                </div>
            </Card>

            {/* 週間テーブル */}
            <Card>
                <Table
                    dataSource={rows}
                    columns={columns}
                    rowKey="key"
                    pagination={false}
                    scroll={{ x: 900 }}
                    size="small"
                    footer={() => (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Text strong>日別合計:</Text>
                            {weekDates.map((date, idx) => (
                                <Tag key={date} color={idx >= 5 ? "red" : "blue"}>
                                    {DAY_LABELS[idx]} {(dailyTotals[date] || 0).toFixed(2)}h
                                </Tag>
                            ))}
                            <Tag color="gold" style={{ marginLeft: 8 }}>
                                週合計: {weekTotal.toFixed(2)}h
                            </Tag>
                        </div>
                    )}
                />
            </Card>
        </div>
    );
}
