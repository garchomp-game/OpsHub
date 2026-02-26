import { searchAll, type SearchAllResponse } from "./_actions";
import SearchResultsClient from "./_components/SearchResultsClient";
import SearchEmptyState from "./_components/SearchEmptyState";
import SearchResultsWrapper from "./_components/SearchResultsWrapper";

export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string;
        category?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = (params.q ?? "").trim();

    // 空クエリ → 入力案内
    if (!query) {
        return <SearchEmptyState />;
    }

    // 検索実行
    const category = (params.category ?? "all") as "all" | "workflows" | "projects" | "tasks" | "expenses";
    const page = parseInt(params.page ?? "1", 10) || 1;

    const result = await searchAll({ query, category, page });

    let data: SearchAllResponse | null = null;
    let errorMessage: string | null = null;

    if (result.success) {
        data = result.data;
    } else {
        errorMessage = result.error.message;
    }

    return (
        <SearchResultsWrapper
            query={query}
            totalCount={data?.counts.all}
            errorMessage={errorMessage}
        >
            {data && (
                <SearchResultsClient
                    data={data}
                    query={query}
                    currentCategory={category}
                />
            )}
        </SearchResultsWrapper>
    );
}
