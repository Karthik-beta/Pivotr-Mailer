import { LeadStatus, type LeadStatusType } from "@shared/constants/status.constants";
import type { Lead } from "@shared/types/lead.types";
import { createColumnHelper } from "@tanstack/react-table";
import { FilePenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const columnHelper = createColumnHelper<Lead>();

export const columns = (onReview: (lead: Lead) => void) => [
	columnHelper.accessor("email", {
		header: "Waitlist Email",
		cell: (info) => <span className="font-medium">{info.getValue()}</span>,
	}),
	columnHelper.accessor("fullName", {
		header: "Full Name",
		cell: (info) => {
			const lead = info.row.original;
			return (
				<div className="flex flex-col">
					<span>{lead.fullName}</span>
					{lead.parsedFirstName && (
						<span className="text-xs text-muted-foreground">Parsed: {lead.parsedFirstName}</span>
					)}
				</div>
			);
		},
	}),
	columnHelper.accessor("companyName", {
		header: "Company",
		cell: (info) => info.getValue() || "-",
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => <LeadStatusBadge status={info.getValue()} />,
	}),
	columnHelper.accessor("verificationResult", {
		header: "Verification",
		cell: (info) => (
			<span className="text-muted-foreground text-xs font-mono">{info.getValue() || "-"}</span>
		),
	}),
	columnHelper.display({
		id: "actions",
		header: () => <div className="text-right">Actions</div>,
		cell: (info) => (
			<div className="text-right">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => onReview(info.row.original)}
					title="Review Name"
				>
					<FilePenLine className="h-4 w-4" />
				</Button>
			</div>
		),
	}),
];

function LeadStatusBadge({ status }: { status: LeadStatusType }) {
	let variant: "default" | "secondary" | "destructive" | "outline" = "outline";

	switch (status) {
		case LeadStatus.VERIFIED:
		case LeadStatus.SENT:
			variant = "default";
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
