"use client";

import { useState } from "react";
import { Input } from "antd";
import { useRouter } from "next/navigation";

export default function HeaderSearchBar() {
    const router = useRouter();
    const [value, setValue] = useState("");

    const handleSearch = (val: string) => {
        const trimmed = val.trim();
        if (!trimmed) return;
        const query = trimmed.slice(0, 100);
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

    return (
        <Input.Search
            placeholder="検索…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 260 }}
            allowClear
        />
    );
}
