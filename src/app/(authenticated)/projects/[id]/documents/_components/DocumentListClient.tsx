"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    App,
    Typography,
    Table,
    Button,
    Space,
    Tag,
    Upload,
} from "antd";
import {
    DownloadOutlined,
    DeleteOutlined,
    InboxOutlined,
    FileOutlined,
    FilePdfOutlined,
    FileImageOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    FilePptOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import {
    uploadDocument,
    deleteDocument,
    getDownloadUrl,
} from "../_actions";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ─── Types ──────────────────────────────────────────

type DocumentItem = {
    id: string;
    tenant_id: string;
    project_id: string | null;
    name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    uploaded_by: string;
    created_at: string;
    updated_at: string;
    profiles: {
        display_name: string | null;
    };
};

type Props = {
    projectId: string;
    projectName: string;
    documents: DocumentItem[];
    canManage: boolean;
};

// ─── MIME Helpers ───────────────────────────────────

const MIME_TAG_CONFIG: Record<string, { label: string; color: string }> = {
    "application/pdf": { label: "PDF", color: "red" },
    "image/png": { label: "画像", color: "blue" },
    "image/jpeg": { label: "画像", color: "blue" },
    "image/gif": { label: "画像", color: "blue" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "DOCX", color: "geekblue" },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "XLSX", color: "green" },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { label: "PPTX", color: "orange" },
    "text/plain": { label: "TXT", color: "default" },
};

function getMimeIcon(mime: string) {
    if (mime === "application/pdf") return <FilePdfOutlined />;
    if (mime.startsWith("image/")) return <FileImageOutlined />;
    if (mime.includes("wordprocessingml")) return <FileWordOutlined />;
    if (mime.includes("spreadsheetml")) return <FileExcelOutlined />;
    if (mime.includes("presentationml")) return <FilePptOutlined />;
    if (mime === "text/plain") return <FileTextOutlined />;
    return <FileOutlined />;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Component ──────────────────────────────────────

export default function DocumentListClient({
    projectId,
    projectName,
    documents,
    canManage,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { message, modal } = App.useApp();
    const [uploading, setUploading] = useState(false);

    // ─── Upload Handler ─────────────────────────────

    const uploadProps: UploadProps = {
        name: "file",
        multiple: true,
        showUploadList: false,
        beforeUpload: (file) => {
            // クライアント側バリデーション
            if (file.size > MAX_FILE_SIZE) {
                message.error("ファイルサイズは10MB以下にしてください");
                return Upload.LIST_IGNORE;
            }
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                message.error("許可されていないファイル形式です");
                return Upload.LIST_IGNORE;
            }
            // カスタムアップロード処理を実行
            handleUpload(file);
            return false; // 自動アップロードを無効化
        },
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await uploadDocument(projectId, formData);
            if (result.success) {
                message.success(`${file.name} をアップロードしました`);
                router.refresh();
            } else {
                message.error(result.error.message);
            }
        } catch {
            message.error("アップロードに失敗しました。再度お試しください");
        } finally {
            setUploading(false);
        }
    };

    // ─── Download Handler ───────────────────────────

    const handleDownload = (documentId: string) => {
        startTransition(async () => {
            const result = await getDownloadUrl({ document_id: documentId });
            if (result.success) {
                window.open(result.data.url, "_blank");
            } else {
                message.error(result.error.message);
            }
        });
    };

    // ─── Delete Handler ─────────────────────────────

    const handleDelete = (doc: DocumentItem) => {
        modal.confirm({
            title: "ドキュメント削除",
            content: `${doc.name} を削除しますか？`,
            okText: "削除",
            cancelText: "キャンセル",
            okType: "danger",
            onOk: async () => {
                const result = await deleteDocument({ document_id: doc.id });
                if (result.success) {
                    message.success(`${doc.name} を削除しました`);
                    router.refresh();
                } else {
                    message.error(result.error.message);
                }
            },
        });
    };

    // ─── Table Columns ──────────────────────────────

    const columns = [
        {
            title: "ファイル名",
            dataIndex: "name",
            key: "name",
            render: (name: string, record: DocumentItem) => (
                <Space>
                    {getMimeIcon(record.mime_type)}
                    <Text>{name}</Text>
                </Space>
            ),
        },
        {
            title: "サイズ",
            dataIndex: "file_size",
            key: "file_size",
            width: 100,
            render: (size: number) => formatFileSize(size),
        },
        {
            title: "種別",
            dataIndex: "mime_type",
            key: "mime_type",
            width: 100,
            render: (mime: string) => {
                const config = MIME_TAG_CONFIG[mime] || { label: mime.split("/").pop(), color: "default" };
                return <Tag color={config.color}>{config.label}</Tag>;
            },
        },
        {
            title: "アップロード者",
            key: "uploader",
            width: 140,
            render: (_: unknown, record: DocumentItem) =>
                record.profiles?.display_name ?? "—",
        },
        {
            title: "日時",
            dataIndex: "created_at",
            key: "created_at",
            width: 160,
            render: (d: string) =>
                new Date(d).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                }),
        },
        {
            title: "操作",
            key: "actions",
            width: 120,
            render: (_: unknown, record: DocumentItem) => (
                <Space>
                    <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(record.id)}
                        loading={isPending}
                    />
                    {canManage && (
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record)}
                        />
                    )}
                </Space>
            ),
        },
    ];

    // ─── Render ─────────────────────────────────────

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button onClick={() => router.push(`/projects/${projectId}`)}>
                    ← PJ詳細に戻る
                </Button>
            </div>

            <Title level={4}>
                {projectName} &gt; ドキュメント
            </Title>

            {canManage && (
                <div style={{ marginBottom: 24 }}>
                    <Dragger {...uploadProps} disabled={uploading}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">
                            {uploading
                                ? "アップロード中..."
                                : "ここにファイルをドラッグ＆ドロップ、またはクリックして選択"}
                        </p>
                        <p className="ant-upload-hint">
                            最大 10MB / PDF, 画像, Office文書, テキスト
                        </p>
                    </Dragger>
                </div>
            )}

            <Table
                dataSource={documents}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: "ドキュメントはありません" }}
                footer={() => <Text type="secondary">全 {documents.length} 件</Text>}
            />
        </div>
    );
}
