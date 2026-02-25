"use client";

import { App } from "antd";

export default function AntdAppProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return <App>{children}</App>;
}
