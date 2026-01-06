import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExcelImportDialog } from "@/features/leads/components/excel-import-dialog";
import { ExportLeadsButton } from "@/features/leads/components/export-leads-button";
import { LeadsTable } from "@/features/leads/components/leads-table";

const searchSchema = z.object({
	page: z.number().optional().default(1),
	search: z.string().optional(),
});

import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Lead } from "@shared/types/lead.types";
import { Query } from "appwrite";
import { databases } from "@/lib/appwrite";
import { leadsKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/leads/")({
	component: LeadsPage,
	validateSearch: searchSchema,
	loaderDeps: ({ search: { page, search } }) => ({ page, search }),
	loader: async ({ context: { queryClient }, deps: { page, search } }) => {
		const limit = 20;
		const queryPage = page || 1;
		await queryClient.ensureQueryData({
			queryKey: leadsKeys.list(queryPage, limit, search),
			queryFn: async () => {
				const offset = (queryPage - 1) * limit;
				const queries = [Query.limit(limit), Query.offset(offset), Query.orderDesc("$createdAt")];

				if (search) {
					queries.push(Query.search("email", search));
				}

				const response = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, queries);

				return {
					leads: response.documents as unknown as Lead[],
					total: response.total,
				}
			},
		})
	},
});

function LeadsPage() {
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();
	const searchParams = Route.useSearch();
	const [searchValue, setSearchValue] = useState(searchParams.search || "");

	const handleSearch = () => {
		navigate({
			search: (prev) => ({ ...prev, search: searchValue || undefined, page: 1 }),
		})
	}

	const handlePageChange = (newPage: number) => {
		navigate({
			search: (prev) => ({ ...prev, page: newPage }),
		})
		// Scroll to top
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	}

	const handleImportSuccess = () => {
		queryClient.invalidateQueries({ queryKey: ["leads"] });
	}

	return (
		<div className="p-8 space-y-6 max-w-[1600px] mx-auto">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight mb-2">Lead Management</h1>
					<p className="text-muted-foreground">Manage waitlist, verify emails, and track status.</p>
				</div>
				<div className="flex gap-2">
					<Link to="/leads/staging">
						<Button variant="outline" className="gap-2">
							<ClipboardList className="h-4 w-4" />
							View Staging
						</Button>
					</Link>
					<ExcelImportDialog onImportSuccess={handleImportSuccess} />
					<ExportLeadsButton />
				</div>
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
	)
}
