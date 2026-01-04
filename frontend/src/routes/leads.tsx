import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { CsvUploader } from "@/features/leads/components/csv-uploader";
import { LeadsTable } from "@/features/leads/components/leads-table";

const searchSchema = z.object({
	page: z.number().optional().default(1),
	search: z.string().optional(),
});

export const Route = createFileRoute("/leads")({
	component: LeadsPage,
	validateSearch: searchSchema,
});

function LeadsPage() {
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
		// Scroll to top
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	return (
		<div className="p-8 space-y-6 max-w-[1600px] mx-auto">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight mb-2">Lead Management</h1>
					<p className="text-muted-foreground">Manage waitlist, verify emails, and track status.</p>
				</div>
				<CsvUploader onUploadSuccess={() => window.location.reload()} />
				{/* Simple reload or query invalidation. Query invalidation is better but reload is easiest "Refetch" handled by React Query internally if I invalidate? 
            CsvUploader handles upload but process is async. List updates via polling or manual refresh. 
            React Query will fetch on mount/focus. 
        */}
			</div>

			<div className="flex items-center space-x-2 max-w-sm">
				<div className="relative w-full">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search by email..."
						className="pl-8"
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
				</div>
			</div>

			<LeadsTable
				page={searchParams.page}
				search={searchParams.search}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
