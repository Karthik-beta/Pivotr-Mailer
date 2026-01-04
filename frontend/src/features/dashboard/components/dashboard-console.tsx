import { LogSeverity } from "@shared/constants/status.constants";
import type { Log } from "@shared/types/log.types";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DashboardConsoleProps {
	logs: Log[];
	className?: string;
}

export function DashboardConsole({ logs, className }: DashboardConsoleProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom on new logs
	useEffect(() => {
		if (viewportRef.current) {
			viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
		}
	}, []);

	return (
		<div
			className={cn(
				"border border-border rounded-md bg-zinc-950 text-zinc-50 font-mono text-xs shadow-inner",
				className
			)}
		>
			<div className="flex items-center px-4 py-2 border-b border-zinc-900 bg-zinc-900/50">
				<div className="flex gap-1.5">
					<div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
					<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
					<div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
				</div>
				<span className="ml-3 text-zinc-400 text-[10px] uppercase tracking-wider font-bold">
					Activity Stream
				</span>
			</div>
			<ScrollArea className="h-[300px]" ref={scrollRef}>
				<div className="p-4 space-y-1.5" ref={viewportRef}>
					{logs.length === 0 && <div className="text-zinc-600 italic">Waiting for activity...</div>}
					{logs.map((log) => (
						<div key={log.$id} className="flex gap-2 break-all">
							<span className="text-zinc-500 shrink-0">
								[{new Date(log.$createdAt).toLocaleTimeString()}]
							</span>
							<SeverityIndicator severity={log.severity} />
							<span>{log.message}</span>
						</div>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

function SeverityIndicator({ severity }: { severity: string }) {
	switch (severity) {
		case LogSeverity.ERROR:
			return <span className="text-red-400 font-bold">[ERR]</span>;
		case LogSeverity.WARN:
			return <span className="text-yellow-400 font-bold">[WRN]</span>;
		case LogSeverity.INFO:
			return <span className="text-blue-400 font-bold">[INF]</span>;
		default:
			return <span className="text-zinc-500">[LOG]</span>;
	}
}
