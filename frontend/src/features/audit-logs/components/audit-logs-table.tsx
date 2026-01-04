import { LogSeverity } from "@shared/constants/status.constants";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { useAuditLogs } from "../hooks/use-audit-logs";

interface AuditLogsTableProps {
	page: number;
	search?: string;
	severity?: string;
	onPageChange: (page: number) => void;
}

export function AuditLogsTable({ page, search, severity, onPageChange }: AuditLogsTableProps) {
	const limit = 20;
	const { data, isLoading } = useAuditLogs(page, limit, { search, severity });

	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

	const toggleRow = (id: string) => {
		const newSet = new Set(expandedRows);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		setExpandedRows(newSet);
	};

	if (isLoading) {
		return <LogsTableSkeleton />;
	}

	const totalPages = data ? Math.ceil(data.total / limit) : 0;

	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[30px]"></TableHead>
							<TableHead className="w-[180px]">Timestamp</TableHead>
							<TableHead className="w-[100px]">Severity</TableHead>
							<TableHead>Message</TableHead>
							<TableHead className="w-[150px]">Context</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.logs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="h-24 text-center">
									No logs found matching criteria.
								</TableCell>
							</TableRow>
						) : (
							data?.logs.map((log) => (
								<Fragment key={log.$id}>
									<TableRow
										key={log.$id}
										className={cn(
											"cursor-pointer hover:bg-muted/50",
											expandedRows.has(log.$id) && "bg-muted/50"
										)}
										onClick={() => toggleRow(log.$id)}
									>
										<TableCell>
											{expandedRows.has(log.$id) ? (
												<ChevronDown className="h-4 w-4 text-muted-foreground" />
											) : (
												<ChevronRight className="h-4 w-4 text-muted-foreground" />
											)}
										</TableCell>
										<TableCell className="font-mono text-xs">
											{format(new Date(log.$createdAt), "PP pp")}
										</TableCell>
										<TableCell>
											<SeverityBadge severity={log.severity} />
										</TableCell>
										<TableCell className="font-medium">
											<div className="flex items-center gap-2">
												{log.eventType}
												<span className="text-muted-foreground font-normal"> - {log.message}</span>
											</div>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground font-mono">
											{log.leadId ? `Lead: ${log.leadId.substring(0, 8)}...` : ""}
										</TableCell>
									</TableRow>
									{expandedRows.has(log.$id) && (
										<TableRow>
											<TableCell colSpan={5} className="p-0 border-b">
												<div className="p-4 bg-muted/30 text-xs font-mono space-y-2">
													<div className="grid grid-cols-2 gap-4">
														<div>
															<h4 className="font-semibold mb-1 text-muted-foreground">
																Payload / Responses
															</h4>
															{log.verifierResponse && (
																<div className="mb-2">
																	<span className="font-bold">Verifier Response:</span>
																	<pre className="mt-1 p-2 bg-background border rounded overflow-x-auto">
																		{JSON.stringify(log.verifierResponse, null, 2)}
																	</pre>
																</div>
															)}
															{log.metadata && (
																<div>
																	<span className="font-bold">Metadata:</span>
																	<pre className="mt-1 p-2 bg-background border rounded overflow-x-auto">
																		{JSON.stringify(log.metadata, null, 2)}
																	</pre>
																</div>
															)}
														</div>
														<div>
															<h4 className="font-semibold mb-1 text-muted-foreground">
																System Details
															</h4>
															<div>
																<span className="font-bold">ID:</span> {log.$id}
															</div>
															{log.processingTimeMs && (
																<div>
																	<span className="font-bold">Duration:</span>{" "}
																	{log.processingTimeMs}ms
																</div>
															)}
															{log.errorDetails && (
																<div className="mt-2 text-destructive">
																	<span className="font-bold">Error Stack:</span>
																	<pre className="mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded overflow-x-auto whitespace-pre-wrap">
																		{log.errorDetails.message}
																		{"\n"}
																		{log.errorDetails.stack}
																	</pre>
																</div>
															)}
														</div>
													</div>
												</div>
											</TableCell>
										</TableRow>
									)}
								</Fragment>
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
		</div>
	);
}

function SeverityBadge({ severity }: { severity: string }) {
	switch (severity) {
		case LogSeverity.ERROR:
		case LogSeverity.FATAL:
			return <Badge variant="destructive">ERROR</Badge>;
		case LogSeverity.WARN:
			return (
				<Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
					WARN
				</Badge>
			);
		case LogSeverity.INFO:
			return (
				<Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
					INFO
				</Badge>
			);
		default:
			return <Badge variant="outline">{severity}</Badge>;
	}
}

function LogsTableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
								<Skeleton className="h-4 w-4" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-32" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-16" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-64" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-24" />
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{[...Array(10)].map((_, i) => (
							<TableRow key={`skeleton-row-${i}`}>
								<TableCell>
									<Skeleton className="h-4 w-4" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-32" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-16" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-full" />
								</TableCell>
								<TableCell>
									<Skeleton className="h-4 w-24" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
