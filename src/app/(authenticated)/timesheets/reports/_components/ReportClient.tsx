"use client";

import { useState, useTransition } from "react";
import {
    App,
    Typography,
    Card,
    Button,
    Space,
    Select,
    DatePicker,
    Table,
    Statistic,
    Row,
    Col,
    Empty,
} from "antd";
import {
    DownloadOutlined,
    SearchOutlined,
    BarChartOutlined,
} from "@ant-design/icons";
import { getReportData } from "../_actions";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type Project = {
    id: string;
    name: string;
};

type Member = {
    user_id: string;
    role: string;
    display_name: string;
};

type ProjectSummary = {
    project_id: string;
    project_name: string;
    total_hours: number;
    member_count: number;
};

type MemberSummary = {
    user_id: string;
    display_name: string;
    total_hours: number;
    project_count: number;
};

type Props = {
    projects: Project[];
    members: Member[];
    canViewOthers: boolean;
    currentUserId: string;
};

export default function ReportClient({
    projects,
    members,
    canViewOthers,
    currentUserId,
}: Props) {
    const { message } = App.useApp();
    const [isPending, startTransition] = useTransition();
    const [dateRange, setDateRange] = useState<[string, string] | null>(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return [
            firstDay.toISOString().split("T")[0],
            lastDay.toISOString().split("T")[0],
        ];
    });
    const [selectedProject, setSelectedProject] = useState<string | undefined>();
    const [selectedMember, setSelectedMember] = useState<string | undefined>();
    const [projectData, setProjectData] = useState<ProjectSummary[]>([]);
    const [memberData, setMemberData] = useState<MemberSummary[]>([]);
    const [grandTotal, setGrandTotal] = useState(0);
    const [loaded, setLoaded] = useState(false);

    const handleSearch = () => {
        if (!dateRange) {
            message.warning("期間を選択してください");
            return;
        }

        startTransition(async () => {
            const result = await getReportData({
                date_from: dateRange[0],
                date_to: dateRange[1],
                project_id: selectedProject,
                member_id: canViewOthers ? selectedMember : currentUserId,
            });

            if (result.success) {
                setProjectData(result.data.projects);
                setMemberData(result.data.members);
                setGrandTotal(result.data.grand_total);
                setLoaded(true);
            } else {
                message.error(result.error.message);
            }
        });
    };

    const handleExport = () => {
        if (!dateRange) {
            message.warning("期間を選択してください");
            return;
        }

        const params = new URLSearchParams({
            date_from: dateRange[0],
            date_to: dateRange[1],
        });
        if (selectedProject) params.set("project_id", selectedProject);
        if (canViewOthers && selectedMember) params.set("member_id", selectedMember);

        window.open(`/api/timesheets/export?${params.toString()}`, "_blank");
    };

    const projectColumns = [
        {
            title: "プロジェクト名",
            dataIndex: "project_name",
            key: "project_name",
        },
        {
            title: "合計工数",
            dataIndex: "total_hours",
            key: "total_hours",
            render: (h: number) => `${h.toFixed(2)}h`,
            sorter: (a: ProjectSummary, b: ProjectSummary) => a.total_hours - b.total_hours,
        },
        {
            title: "メンバー数",
            dataIndex: "member_count",
            key: "member_count",
        },
    ];

    const memberColumns = [
        {
            title: "ユーザー",
            dataIndex: "display_name",
            key: "display_name",
        },
        {
            title: "合計工数",
            dataIndex: "total_hours",
            key: "total_hours",
            render: (h: number) => `${h.toFixed(2)}h`,
            sorter: (a: MemberSummary, b: MemberSummary) => a.total_hours - b.total_hours,
        },
        {
            title: "プロジェクト数",
            dataIndex: "project_count",
            key: "project_count",
        },
    ];

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    工数レポート
                </Title>
                <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    disabled={!dateRange}
                >
                    CSV ダウンロード
                </Button>
            </div>

            {/* フィルタ */}
            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>期間</Text>
                        <RangePicker
                            onChange={(_, dateStrings) => {
                                if (dateStrings[0] && dateStrings[1]) {
                                    setDateRange([dateStrings[0], dateStrings[1]]);
                                }
                            }}
                            style={{ width: 280 }}
                        />
                    </div>
                    <div>
                        <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>プロジェクト</Text>
                        <Select
                            placeholder="すべてのプロジェクト"
                            allowClear
                            value={selectedProject}
                            onChange={setSelectedProject}
                            style={{ width: 200 }}
                        >
                            {projects.map((p) => (
                                <Select.Option key={p.id} value={p.id}>
                                    {p.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </div>
                    {canViewOthers && (
                        <div>
                            <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>メンバー</Text>
                            <Select
                                placeholder="すべてのメンバー"
                                allowClear
                                value={selectedMember}
                                onChange={setSelectedMember}
                                style={{ width: 200 }}
                            >
                                {members.map((m) => (
                                    <Select.Option key={m.user_id} value={m.user_id}>
                                        {m.display_name}（{m.role}）
                                    </Select.Option>
                                ))}
                            </Select>
                        </div>
                    )}
                    <div style={{ alignSelf: "flex-end" }}>
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={handleSearch}
                            loading={isPending}
                        >
                            検索
                        </Button>
                    </div>
                </Space>
            </Card>

            {!loaded ? (
                <Card>
                    <Empty description="期間を選択して検索してください" />
                </Card>
            ) : (
                <>
                    {/* サマリカード */}
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="合計工数"
                                    value={grandTotal}
                                    suffix="h"
                                    precision={2}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="プロジェクト数"
                                    value={projectData.length}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="メンバー数"
                                    value={memberData.length}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* プロジェクト別集計 */}
                    <Card title="プロジェクト別集計" style={{ marginBottom: 16 }}>
                        <Table
                            dataSource={projectData}
                            columns={projectColumns}
                            rowKey="project_id"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: "データがありません" }}
                        />
                    </Card>

                    {/* メンバー別集計 */}
                    <Card title="メンバー別集計">
                        <Table
                            dataSource={memberData}
                            columns={memberColumns}
                            rowKey="user_id"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: "データがありません" }}
                        />
                    </Card>
                </>
            )}
        </div>
    );
}
