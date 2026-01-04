import { BucketId } from "@shared/constants/collection.constants";
import { ID } from "appwrite";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/appwrite";

interface CsvUploaderProps {
	onUploadSuccess?: () => void;
}

export function CsvUploader({ onUploadSuccess }: CsvUploaderProps) {
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.name.endsWith(".csv")) {
			toast.error("Only CSV files are allowed");
			return;
		}

		setIsUploading(true);
		try {
			// Upload to Appwrite Storage
			// Trigger function will pick this up automatically
			await storage.createFile(BucketId.CSV_IMPORTS, ID.unique(), file);

			toast.success("File uploaded. Processing started in background.");
			if (onUploadSuccess) onUploadSuccess();

			// Reset input
			if (fileInputRef.current) fileInputRef.current.value = "";
		} catch (error) {
			console.error(error);
			toast.error("Failed to upload file");
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div>
			<input
				type="file"
				accept=".csv"
				className="hidden"
				ref={fileInputRef}
				onChange={handleFileChange}
			/>
			<Button
				variant="outline"
				onClick={() => fileInputRef.current?.click()}
				disabled={isUploading}
				className="gap-2 bg-card"
			>
				{isUploading ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Upload className="h-4 w-4" />
				)}
				Import Leads (CSV)
			</Button>
		</div>
	);
}
