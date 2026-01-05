import { LogSeverity } from "@shared/constants/status.constants";
import type { Log } from "@shared/types/log.types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DashboardConsoleProps {
	logs: Log[];
	className?: string;
}

export function DashboardConsole({ logs, className }: DashboardConsoleProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const isAutoScrollEnabled = useRef(true);

	const rowVirtualizer = useVirtualizer({
		count: logs.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 24, // Estimate 24px per row
		overscan: 10,
	});

	// Handle auto-scroll logic
	useEffect(() => {
		const element = parentRef.current;
		if (!element) return;

		const onScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = element;
			// If user scrolls up, disable auto-scroll
			// Tolerance of 50px
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
			isAutoScrollEnabled.current = isAtBottom;
		};

		element.addEventListener("scroll", onScroll);
		return () => element.removeEventListener("scroll", onScroll);
	}, []);

	// Scroll to bottom when new logs arrive, if auto-scroll is enabled
	useEffect(() => {
		if (isAutoScrollEnabled.current && logs.length > 0) {
			rowVirtualizer.scrollToIndex(logs.length - 1, { align: "end" });
		}
	}, [logs.length, rowVirtualizer]);

	return (
		<div
			className={cn(
				"flex flex-col border border-border rounded-md bg-zinc-950 text-zinc-50 font-mono text-xs shadow-inner h-[350px]", // Fixed height for container
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center px-4 py-2 border-b border-zinc-900 bg-zinc-900/50 shrink-0">
				<div className="flex gap-1.5">
					<div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
					<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
					<div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
				</div>
				<span className="ml-3 text-zinc-400 text-[10px] uppercase tracking-wider font-bold">
					Activity Stream ({logs.length})
				</span>
			</div>

			{/* Scrollable Virtual Area */}
			<div
				ref={parentRef}
				className="flex-1 overflow-y-auto contain-strict"
				style={{
					// Fix for some browsers to allow smooth scrolling
					overflowAnchor: "none",
				}}
			>
				<div
					style={{
						height: `${rowVirtualizer.getTotalSize()}px`,
						width: "100%",
						position: "relative",
					}}
				>
					{logs.length === 0 && (
						<div className="absolute top-4 left-4 text-zinc-600 italic">
							Waiting for activity...
						</div>
					)}
					{rowVirtualizer.getVirtualItems().map((virtualRow) => {
						const log = logs[virtualRow.index];
						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={rowVirtualizer.measureElement}
								className="flex gap-2 px-4 py-1 break-all hover:bg-white/5 transition-colors"
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									transform: `translateY(${virtualRow.start}px)`,
								}}
							>
								<span className="text-zinc-500 shrink-0 select-none">
									[{new Date(log.$createdAt).toLocaleTimeString()}]
								</span>
								<SeverityIndicator severity={log.severity} />
								<span className="whitespace-pre-wrap">{log.message}</span>
							</div>
						);
					})}
				</div>
			</div>
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
