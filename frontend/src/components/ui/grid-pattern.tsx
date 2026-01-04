import { cn } from "@/lib/utils";

interface GridPatternProps extends React.HTMLAttributes<HTMLDivElement> {
	width?: number;
	height?: number;
	x?: number;
	y?: number;
	strokeDasharray?: string | number;
	numSquares?: number;
	className?: string;
	maxOpacity?: number;
	duration?: number;
	repeatDelay?: number;
}

export function GridPattern({ className, ...props }: GridPatternProps) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-0 h-full w-full",
				"bg-[linear-gradient(to_right,#80808033_1px,transparent_1px),linear-gradient(to_bottom,#80808033_1px,transparent_1px)]",
				"bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]",
				className
			)}
			{...props}
		/>
	);
}
