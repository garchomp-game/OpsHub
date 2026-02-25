"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    App,
    Form,
    Input,
    Select,
    InputNumber,
    DatePicker,
    Button,
    Card,
    Typography,
    Space,
    Divider,
    Table,
    Tag,
    Popconfirm,
} from "antd";
import { PlusOutlined, DeleteOutlined, PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    createInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
} from "../_actions";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_STATUS_TRANSITIONS, type InvoiceStatus } from "../_constants";

const { Title, Text } = Typography;
const { TextArea } = Input;

type Project = {
    id: string;
    name: string;
    status: string;
};

type InvoiceItem = {
    key: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
};

type InvoiceData = {
    id: string;
    invoice_number: string;
    client_name: string;
    project_id: string | null;
    issued_date: string;
    due_date: string;
    tax_rate: number;
    notes: string | null;
    status: InvoiceStatus;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
};

type InvoiceItemData = {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
};

type Props = {
    mode: "new" | "edit";
    projects: Project[];
    userRole: "admin" | "pm";
    initialInvoice?: InvoiceData;
    initialItems?: InvoiceItemData[];
};

let itemKeyCounter = 0;
function nextKey() {
    itemKeyCounter += 1;
    return `item-${itemKeyCounter}`;
}

export default function InvoiceForm({
    mode,
    projects,
    userRole,
    initialInvoice,
    initialItems,
}: Props) {
    const router = useRouter();
    const [form] = Form.useForm();
    const [isPending, startTransition] = useTransition();
    const { message } = App.useApp();

    // 明細行の状態管理
    const [items, setItems] = useState<InvoiceItem[]>(() => {
        if (initialItems && initialItems.length > 0) {
            return initialItems.map((item) => ({
                key: nextKey(),
                description: item.description,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                amount: Number(item.amount),
            }));
        }
        return [{ key: nextKey(), description: "", quantity: 1, unit_price: 0, amount: 0 }];
    });

    const [taxRate, setTaxRate] = useState<number>(
        initialInvoice?.tax_rate ? Number(initialInvoice.tax_rate) : 10
    );

    // 金額計算
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.floor(subtotal * taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const isEditable = userRole === "admin" && (mode === "new" || initialInvoice?.status === "draft");
    const currentStatus = initialInvoice?.status;

    // 行操作
    const addRow = useCallback(() => {
        setItems((prev) => [
            ...prev,
            { key: nextKey(), description: "", quantity: 1, unit_price: 0, amount: 0 },
        ]);
    }, []);

    const removeRow = useCallback((key: string) => {
        setItems((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((item) => item.key !== key);
        });
    }, []);

    const updateItem = useCallback(
        (key: string, field: keyof InvoiceItem, value: string | number) => {
            setItems((prev) =>
                prev.map((item) => {
                    if (item.key !== key) return item;
                    const updated = { ...item, [field]: value };
                    if (field === "quantity" || field === "unit_price") {
                        updated.amount = Math.round(updated.quantity * updated.unit_price);
                    }
                    return updated;
                })
            );
        },
        []
    );

    const formatCurrency = (value: number) =>
        `¥${value.toLocaleString()}`;

    // 保存処理
    const handleSave = () => {
        form.validateFields().then((values) => {
            // 明細バリデーション
            for (const item of items) {
                if (!item.description?.trim()) {
                    message.error("品目名は必須です");
                    return;
                }
                if (!item.quantity || item.quantity <= 0) {
                    message.error("数量は0より大きい値を入力してください");
                    return;
                }
                if (item.unit_price < 0) {
                    message.error("単価は0以上で入力してください");
                    return;
                }
            }

            startTransition(async () => {
                const payload = {
                    client_name: values.client_name as string,
                    project_id: values.project_id as string | undefined,
                    issued_date: (values.issued_date as dayjs.Dayjs).format("YYYY-MM-DD"),
                    due_date: (values.due_date as dayjs.Dayjs).format("YYYY-MM-DD"),
                    tax_rate: taxRate,
                    notes: values.notes as string | undefined,
                    items: items.map((item) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                    })),
                };

                if (mode === "new") {
                    const result = await createInvoice(payload);
                    if (result.success) {
                        message.success("請求書を保存しました");
                        router.push(`/invoices/${result.data.invoice.id}`);
                    } else {
                        message.error(result.error.message);
                    }
                } else {
                    const result = await updateInvoice({
                        id: initialInvoice!.id,
                        ...payload,
                    });
                    if (result.success) {
                        message.success("請求書を更新しました");
                        router.refresh();
                    } else {
                        message.error(result.error.message);
                    }
                }
            });
        });
    };

    // ステータス変更
    const handleStatusChange = (newStatus: "sent" | "paid" | "cancelled") => {
        startTransition(async () => {
            const result = await updateInvoiceStatus({
                id: initialInvoice!.id,
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

    // 削除
    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteInvoice({
                invoice_id: initialInvoice!.id,
            });
            if (result.success) {
                message.success("請求書を削除しました");
                router.push("/invoices");
            } else {
                message.error(result.error.message);
            }
        });
    };

    // 明細テーブルカラム定義
    const columns = [
        {
            title: "品目",
            dataIndex: "description",
            key: "description",
            width: "35%",
            render: (_: unknown, record: InvoiceItem) =>
                isEditable ? (
                    <Input
                        value={record.description}
                        placeholder="品目名"
                        onChange={(e) => updateItem(record.key, "description", e.target.value)}
                    />
                ) : (
                    <Text>{record.description}</Text>
                ),
        },
        {
            title: "数量",
            dataIndex: "quantity",
            key: "quantity",
            width: "15%",
            render: (_: unknown, record: InvoiceItem) =>
                isEditable ? (
                    <InputNumber
                        value={record.quantity}
                        min={0.01}
                        step={1}
                        precision={2}
                        style={{ width: "100%" }}
                        onChange={(val) => updateItem(record.key, "quantity", val ?? 0)}
                    />
                ) : (
                    <Text>{record.quantity}</Text>
                ),
        },
        {
            title: "単価",
            dataIndex: "unit_price",
            key: "unit_price",
            width: "20%",
            render: (_: unknown, record: InvoiceItem) =>
                isEditable ? (
                    <InputNumber
                        value={record.unit_price}
                        min={0}
                        step={100}
                        style={{ width: "100%" }}
                        formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        parser={(value) => Number(value?.replace(/¥\s?|(,*)/g, "") ?? 0) as unknown as 0}
                        onChange={(val) => updateItem(record.key, "unit_price", val ?? 0)}
                    />
                ) : (
                    <Text>{formatCurrency(record.unit_price)}</Text>
                ),
        },
        {
            title: "金額",
            dataIndex: "amount",
            key: "amount",
            width: "20%",
            render: (_: unknown, record: InvoiceItem) => (
                <Text strong>{formatCurrency(record.amount)}</Text>
            ),
        },
        ...(isEditable
            ? [
                {
                    title: "操作",
                    key: "action",
                    width: "10%",
                    render: (_: unknown, record: InvoiceItem) => (
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={items.length <= 1}
                            onClick={() => removeRow(record.key)}
                        />
                    ),
                },
            ]
            : []),
    ];

    // 遷移可能なステータス
    const allowedTransitions = currentStatus
        ? INVOICE_STATUS_TRANSITIONS[currentStatus] ?? []
        : [];

    return (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0 }}>
                    {mode === "new" ? "請求書作成" : "請求書詳細"}
                </Title>
                {currentStatus && (
                    <Tag color={INVOICE_STATUS_COLORS[currentStatus]}>
                        {INVOICE_STATUS_LABELS[currentStatus]}
                    </Tag>
                )}
            </div>

            {/* ヘッダー情報 */}
            <Card title="ヘッダー情報" style={{ marginBottom: 16 }}>
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                    initialValues={
                        initialInvoice
                            ? {
                                client_name: initialInvoice.client_name,
                                project_id: initialInvoice.project_id || undefined,
                                issued_date: dayjs(initialInvoice.issued_date),
                                due_date: dayjs(initialInvoice.due_date),
                                notes: initialInvoice.notes || undefined,
                            }
                            : {}
                    }
                >
                    {mode === "edit" && initialInvoice && (
                        <Form.Item label="請求番号">
                            <Input
                                value={initialInvoice.invoice_number}
                                disabled
                                style={{ maxWidth: 240 }}
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="client_name"
                        label="取引先名"
                        rules={[
                            { required: true, message: "取引先名は必須です" },
                            { max: 200, message: "200文字以内で入力してください" },
                        ]}
                    >
                        <Input
                            placeholder="取引先名を入力"
                            disabled={!isEditable}
                        />
                    </Form.Item>

                    <Form.Item
                        name="project_id"
                        label="プロジェクト"
                    >
                        <Select
                            placeholder="プロジェクトを選択（任意）"
                            allowClear
                            disabled={!isEditable}
                        >
                            {projects.map((p) => (
                                <Select.Option key={p.id} value={p.id}>
                                    {p.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Space size="middle" style={{ display: "flex" }}>
                        <Form.Item
                            name="issued_date"
                            label="発行日"
                            rules={[{ required: true, message: "発行日は必須です" }]}
                            style={{ flex: 1 }}
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                placeholder="発行日"
                                disabled={!isEditable}
                            />
                        </Form.Item>

                        <Form.Item
                            name="due_date"
                            label="支払期日"
                            rules={[{ required: true, message: "支払期日は必須です" }]}
                            style={{ flex: 1 }}
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                placeholder="支払期日"
                                disabled={!isEditable}
                            />
                        </Form.Item>
                    </Space>

                    <Form.Item name="notes" label="備考">
                        <TextArea
                            rows={3}
                            placeholder="備考（任意）"
                            disabled={!isEditable}
                        />
                    </Form.Item>
                </Form>
            </Card>

            {/* 明細テーブル */}
            <Card
                title="明細"
                style={{ marginBottom: 16 }}
                extra={
                    isEditable && (
                        <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={addRow}
                        >
                            行追加
                        </Button>
                    )
                }
            >
                <Table
                    dataSource={items}
                    columns={columns}
                    rowKey="key"
                    pagination={false}
                    size="small"
                />
            </Card>

            {/* 合計セクション */}
            <Card title="合計" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <Space>
                        <Text>小計:</Text>
                        <Text strong style={{ minWidth: 120, textAlign: "right", display: "inline-block" }}>
                            {formatCurrency(subtotal)}
                        </Text>
                    </Space>
                    <Space>
                        <Text>消費税率:</Text>
                        {isEditable ? (
                            <InputNumber
                                value={taxRate}
                                min={0}
                                max={100}
                                step={1}
                                addonAfter="%"
                                style={{ width: 120 }}
                                onChange={(val) => setTaxRate(val ?? 10)}
                            />
                        ) : (
                            <Text>{taxRate}%</Text>
                        )}
                        <Text>→ 消費税額:</Text>
                        <Text strong style={{ minWidth: 120, textAlign: "right", display: "inline-block" }}>
                            {formatCurrency(taxAmount)}
                        </Text>
                    </Space>
                    <Divider style={{ margin: "4px 0" }} />
                    <Space>
                        <Text strong style={{ fontSize: 16 }}>合計金額:</Text>
                        <Text strong style={{ fontSize: 16, minWidth: 120, textAlign: "right", display: "inline-block" }}>
                            {formatCurrency(totalAmount)}
                        </Text>
                    </Space>
                </div>
            </Card>

            {/* アクションボタン */}
            <Card>
                <Space wrap>
                    {/* 下書き保存: 新規 or draft */}
                    {isEditable && (
                        <Button
                            onClick={handleSave}
                            loading={isPending}
                        >
                            下書き保存
                        </Button>
                    )}

                    {/* ステータス変更ボタン */}
                    {userRole === "admin" && mode === "edit" && currentStatus && (
                        <>
                            {allowedTransitions.includes("sent") && (
                                <Popconfirm
                                    title="送付済みに変更しますか？"
                                    onConfirm={() => handleStatusChange("sent")}
                                >
                                    <Button type="primary" loading={isPending}>
                                        送付済みに変更
                                    </Button>
                                </Popconfirm>
                            )}
                            {allowedTransitions.includes("paid") && (
                                <Popconfirm
                                    title="入金済みに変更しますか？"
                                    onConfirm={() => handleStatusChange("paid")}
                                >
                                    <Button type="primary" loading={isPending}>
                                        入金済みに変更
                                    </Button>
                                </Popconfirm>
                            )}
                            {allowedTransitions.includes("cancelled") && (
                                <Popconfirm
                                    title="キャンセルしますか？"
                                    onConfirm={() => handleStatusChange("cancelled")}
                                >
                                    <Button danger loading={isPending}>
                                        キャンセル
                                    </Button>
                                </Popconfirm>
                            )}
                        </>
                    )}

                    {/* 削除: draft のみ */}
                    {userRole === "admin" && mode === "edit" && currentStatus === "draft" && (
                        <Popconfirm
                            title="本当に削除しますか？"
                            description="この操作は取り消せません。"
                            onConfirm={handleDelete}
                        >
                            <Button danger loading={isPending}>
                                削除
                            </Button>
                        </Popconfirm>
                    )}

                    {/* PDF出力 */}
                    {mode === "edit" && (
                        <Button
                            icon={<PrinterOutlined />}
                            onClick={() => window.print()}
                        >
                            PDF出力
                        </Button>
                    )}

                    <Button onClick={() => router.push("/invoices")}>
                        戻る
                    </Button>
                </Space>
            </Card>
        </div>
    );
}
