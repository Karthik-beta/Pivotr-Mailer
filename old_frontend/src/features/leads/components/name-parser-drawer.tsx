import type { Lead } from "@shared/types/lead.types";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateLead } from "../hooks/use-leads";

interface NameParserDrawerProps {
	lead: Lead | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
}

export function NameParserDrawer({ lead, open, onOpenChange, onSaved }: NameParserDrawerProps) {
	const [parsedName, setParsedName] = useState("");
	const parsedId = useId();
	const updateLead = useUpdateLead();

	useEffect(() => {
		if (lead) {
			setParsedName(lead.parsedFirstName || "");
		}
	}, [lead]);

	const handleSave = () => {
		if (!lead) return;
		updateLead.mutate(
			{ leadId: lead.$id, data: { parsedFirstName: parsedName } },
			{
				onSuccess: () => {
					onSaved();
					onOpenChange(false);
				},
			}
		);
	};

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<div className="mx-auto w-full max-w-sm">
					<DrawerHeader>
						<DrawerTitle>Review Parsed Name</DrawerTitle>
						<DrawerDescription>
							Confirm or correct the first name extracted from the full name.
						</DrawerDescription>
					</DrawerHeader>

					<div className="p-4 pb-0 space-y-4">
						<div className="space-y-2">
							<Label>Full Name (Original)</Label>
							<div className="p-2 border rounded-md bg-muted text-sm font-medium">
								{lead?.fullName || "-"}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor={parsedId}>Parsed First Name</Label>
							<Input
								id={parsedId}
								value={parsedName}
								onChange={(e) => setParsedName(e.target.value)}
								placeholder="Enter first name..."
							/>
						</div>
					</div>

					<DrawerFooter>
						<Button onClick={handleSave} disabled={updateLead.isPending}>
							{updateLead.isPending ? "Saving..." : "Save Changes"}
						</Button>
						<DrawerClose asChild>
							<Button variant="outline">Cancel</Button>
						</DrawerClose>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
