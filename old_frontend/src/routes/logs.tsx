import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { AuditLogsTable } from "@/features/audit-logs/components/audit-logs-table";

const searchSchema = z.object({
	page: z.number().optional().default(1),
	search: z.string().optional(),
});

export const Route = createFileRoute("/logs")({
	component: LogsPage,
	validateSearch: searchSchema,
});

function LogsPage() {
	const navigate = useNavigate({ from: Route.fullPath });
	const searchParams = Route.useSearch();
	const [searchValue, setSearchValue] = useState(searchParams.search || "");

	const handleSearch = () => {
		navigate({
			search: (prev) => ({ ...prev, search: searchValue || undefined, page: 1 }),
		});
	};

	const handlePageChange = (newPage: number) => {
		navigate({
			search: (prev) => ({ ...prev, page: newPage }),
		});
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	return (
		<div className="p-8 space-y-6 max-w-[1600px] mx-auto">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-bold tracking-tight mb-2">System Logs</h1>
				<p className="text-muted-foreground">
					Audit trail of system events, errors, and operations.
				</p>
			</div>

			<div className="flex items-center space-x-2 max-w-sm">
				<div className="relative w-full">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search logs..."
						className="pl-8 bg-background"
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
				</div>
			</div>

			<AuditLogsTable
				page={searchParams.page}
				search={searchParams.search}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
