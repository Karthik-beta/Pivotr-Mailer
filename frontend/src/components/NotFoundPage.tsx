import { Link } from "@tanstack/react-router";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
	return (
		<div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
			{/* Animated compass icon */}
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
				<div className="relative bg-card border rounded-2xl p-6 shadow-lg">
					<Compass className="h-16 w-16 text-muted-foreground animate-[spin_8s_ease-in-out_infinite]" />
				</div>
			</div>

			{/* 404 text */}
			<div className="space-y-3 mb-8">
				<h1 className="text-8xl font-bold tracking-tighter text-foreground/10 select-none">404</h1>
				<h2 className="text-2xl font-semibold tracking-tight -mt-14 relative">Page not found</h2>
				<p className="text-muted-foreground max-w-md mx-auto">
					The page you're looking for doesn't exist or has been moved. Let's get you back on track.
				</p>
			</div>

			{/* Action button */}
			<Link to="/">
				<Button variant="outline" size="lg" className="gap-2">
					<ArrowLeft className="h-4 w-4" />
					Back to Dashboard
				</Button>
			</Link>
		</div>
	);
}
