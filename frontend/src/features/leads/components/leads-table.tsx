import { LeadStatus, type LeadStatusType } from "@shared/constants/status.constants";
import type { Lead } from "@shared/types/lead.types";
import { FilePenLine } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useLeads } from "../hooks/use-leads";
import { NameParserDrawer } from "./name-parser-drawer";

interface LeadsTableProps {
	page: number;
	search?: string;
	onPageChange: (page: number) => void;
}

export function LeadsTable({ page, search, onPageChange }: LeadsTableProps) {
	const limit = 20;
	const { data, isLoading, refetch } = useLeads(page, limit, search);

	const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const handleReviewClick = (lead: Lead) => {
		setSelectedLead(lead);
		setDrawerOpen(true);
	};

	const handleNameSaved = () => {
		refetch(); // Refresh list to show updated name
	};

	if (isLoading) {
		return <LeadsTableSkeleton />;
	}

	const totalPages = data ? Math.ceil(data.total / limit) : 0;

	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Waitlist Email</TableHead>
							<TableHead>Full Name</TableHead>
							<TableHead>Company</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Verification</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.leads.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									No leads found.
								</TableCell>
							</TableRow>
						) : (
							data?.leads.map((lead) => (
								<TableRow key={lead.$id}>
									<TableCell className="font-medium">{lead.email}</TableCell>
									<TableCell>
										<div className="flex flex-col">
											<span>{lead.fullName}</span>
											{lead.parsedFirstName && (
												<span className="text-xs text-muted-foreground">
													Parsed: {lead.parsedFirstName}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>{lead.companyName || "-"}</TableCell>
									<TableCell>
										<LeadStatusBadge status={lead.status} />
									</TableCell>
									<TableCell className="text-muted-foreground text-xs font-mono">
										{lead.verificationResult || "-"}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleReviewClick(lead)}
											title="Review Name"
										>
											<FilePenLine className="h-4 w-4" />
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{totalPages > 1 && (
				<Pagination>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={(e) => {
									e.preventDefault();
									if (page > 1) onPageChange(page - 1);
								}}
								className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
							/>
						</PaginationItem>
						<PaginationItem>
							<span className="px-4 text-sm text-muted-foreground">
								Page {page} of {totalPages}
							</span>
						</PaginationItem>
						<PaginationItem>
							<PaginationNext
								href="#"
								onClick={(e) => {
									e.preventDefault();
									if (page < totalPages) onPageChange(page + 1);
								}}
								className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			)}

			<NameParserDrawer
				lead={selectedLead}
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				onSaved={handleNameSaved}
			/>
		</div>
	);
}

function LeadStatusBadge({ status }: { status: LeadStatusType }) {
	let variant: "default" | "secondary" | "destructive" | "outline" = "outline";

	switch (status) {
		case LeadStatus.VERIFIED:
		case LeadStatus.SENT:
			variant = "default"; // dark/primary
			break;
		case LeadStatus.INVALID:
		case LeadStatus.BOUNCED:
		case LeadStatus.ERROR:
			variant = "destructive";
			break;
		case LeadStatus.VERIFYING:
		case LeadStatus.SENDING:
			variant = "secondary";
			break;
	}

	return <Badge variant={variant}>{status}</Badge>;
}

function LeadsTableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
								<Skeleton className="h-4 w-24" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-32" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-24" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-16" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-16" />
							</TableHead>
							<TableHead className="text-right">
								<Skeleton className="h-4 w-8 ml-auto" />
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{[...Array(5)].map((_, i) => (
							<TableRow key={`skeleton-row-${i}`}>
								<TableCell>
									<Skeleton className="h-4 w-32" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-40" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-24" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-16" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-20" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-8 w-8 ml-auto" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
