"use client";

import { Typography, Divider } from "antd";


const { Title, Text } = Typography;

type PrintItem = {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
};

type Props = {
    invoiceNumber: string;
    clientName: string;
    issuedDate: string;
    dueDate: string;
    notes: string | null;
    items: PrintItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
};

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

export default function InvoicePrintView({
    invoiceNumber,
    clientName,
    issuedDate,
    dueDate,
    notes,
    items,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
}: Props) {
    return (
        <>
            {/* 印刷用CSS */}
            <style jsx global>{`
                @media print {
                    /* ナビゲーションやボタンを非表示 */
                    nav, aside, header,
                    .ant-layout-sider,
                    .ant-layout-header,
                    .no-print {
                        display: none !important;
                    }

                    .ant-layout-content {
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .print-view {
                        display: block !important;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        z-index: 99999;
                        background: white;
                        padding: 40px;
                    }

                    @page {
                        size: A4 portrait;
                        margin: 20mm;
                    }

                    .print-table {
                        width: 100%;
                        border-collapse: collapse;
                    }

                    .print-table th,
                    .print-table td {
                        border: 1px solid #333;
                        padding: 8px 12px;
                        text-align: left;
                    }

                    .print-table th {
                        background: #f0f0f0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .print-table .text-right {
                        text-align: right;
                    }
                }

                @media screen {
                    .print-view {
                        display: none;
                    }
                }
            `}</style>

            <div className="print-view">
                {/* ヘッダー */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <Title level={2} style={{ margin: 0 }}>請 求 書</Title>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                    <div>
                        <Title level={4} style={{ margin: 0, borderBottom: "2px solid #333", paddingBottom: 4 }}>
                            {clientName} 御中
                        </Title>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div><Text strong>請求番号:</Text> {invoiceNumber}</div>
                        <div><Text strong>発行日:</Text> {issuedDate}</div>
                        <div><Text strong>支払期日:</Text> {dueDate}</div>
                    </div>
                </div>

                <Divider />

                {/* 明細テーブル */}
                <table className="print-table">
                    <thead>
                        <tr>
                            <th style={{ width: "5%" }}>#</th>
                            <th style={{ width: "40%" }}>品目</th>
                            <th style={{ width: "15%" }} className="text-right">数量</th>
                            <th style={{ width: "20%" }} className="text-right">単価</th>
                            <th style={{ width: "20%" }} className="text-right">金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{item.description}</td>
                                <td className="text-right">{item.quantity}</td>
                                <td className="text-right">{formatCurrency(Number(item.unit_price))}</td>
                                <td className="text-right">{formatCurrency(Number(item.amount))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 合計セクション */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                    <table style={{ borderCollapse: "collapse", minWidth: 300 }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: "6px 16px", textAlign: "right" }}>小計</td>
                                <td style={{ padding: "6px 16px", textAlign: "right", fontWeight: "bold" }}>
                                    {formatCurrency(subtotal)}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: "6px 16px", textAlign: "right" }}>
                                    消費税（{taxRate}%）
                                </td>
                                <td style={{ padding: "6px 16px", textAlign: "right", fontWeight: "bold" }}>
                                    {formatCurrency(taxAmount)}
                                </td>
                            </tr>
                            <tr style={{ borderTop: "2px solid #333" }}>
                                <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 16, fontWeight: "bold" }}>
                                    合計金額
                                </td>
                                <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 16, fontWeight: "bold" }}>
                                    {formatCurrency(totalAmount)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 備考 */}
                {notes && (
                    <div style={{ marginTop: 32 }}>
                        <Text strong>備考:</Text>
                        <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{notes}</div>
                    </div>
                )}
            </div>
        </>
    );
}
