/**
 * AssignLeadsDialog Component
 *
 * Dialog for assigning leads to a campaign.
 */

import { useState, useEffect } from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { usePreviewLeads, useAssignLeads } from '../hooks/useCampaigns';
import type { LeadType } from '../types';

interface AssignLeadsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string;
}

const LEAD_TYPES: { value: LeadType; label: string }[] = [
    { value: 'HARDWARE', label: 'Hardware' },
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'BOTH', label: 'Both' },
];

const LEAD_STATUSES = [
    { value: 'PENDING_IMPORT', label: 'Pending Import' },
    { value: 'VERIFIED', label: 'Verified' },
    { value: 'RISKY', label: 'Risky' },
];

export function AssignLeadsDialog({ open, onOpenChange, campaignId }: AssignLeadsDialogProps) {
    const [leadTypes, setLeadTypes] = useState<LeadType[]>([]);
    const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
    const [maxLeads, setMaxLeads] = useState<number>(1000);

    const previewMutation = usePreviewLeads();
    const assignMutation = useAssignLeads();

    const toggleType = (type: LeadType, checked: boolean) => {
        setLeadTypes((prev) => (checked ? [...prev, type] : prev.filter((t) => t !== type)));
    };

    const toggleStatus = (status: string, checked: boolean) => {
        setLeadStatuses((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)));
    };

    // Refresh preview when selection changes
    useEffect(() => {
        if (open && leadTypes.length > 0 && leadStatuses.length > 0) {
            const timer = setTimeout(() => {
                previewMutation.mutate({
                    leadTypes,
                    statuses: leadStatuses,
                    maxLeads,
                });
            }, 300);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadTypes, leadStatuses, maxLeads, open]);

    const handleAssign = async () => {
        if (leadTypes.length === 0 || leadStatuses.length === 0) {
            toast.error('Please select at least one lead type and status');
            return;
        }

        try {
            const result = await assignMutation.mutateAsync({
                id: campaignId,
                data: {
                    leadTypes,
                    statuses: leadStatuses,
                    maxLeads,
                },
            });
            toast.success(`${result.data.assignedCount} leads assigned successfully!`);
            onOpenChange(false);
            // Reset form
            setLeadTypes([]);
            setLeadStatuses([]);
            setMaxLeads(1000);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to assign leads');
        }
    };

    const previewCount = previewMutation.data?.data?.count ?? 0;
    const isLoadingPreview = previewMutation.isPending;
    const isAssigning = assignMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Assign Leads</DialogTitle>
                    <DialogDescription>
                        Select criteria to add more leads to this campaign.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Lead Type Selection */}
                    <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                            Lead Types
                        </Label>
                        <div className="flex flex-wrap gap-4">
                            {LEAD_TYPES.map(({ value, label }) => (
                                <div key={value} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`assign-type-${value}`}
                                        checked={leadTypes.includes(value)}
                                        onCheckedChange={(checked) =>
                                            toggleType(value, checked as boolean)
                                        }
                                    />
                                    <Label
                                        htmlFor={`assign-type-${value}`}
                                        className="cursor-pointer"
                                    >
                                        {label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status Selection */}
                    <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                            Lead Statuses
                        </Label>
                        <div className="flex flex-wrap gap-4">
                            {LEAD_STATUSES.map(({ value, label }) => (
                                <div key={value} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`assign-status-${value}`}
                                        checked={leadStatuses.includes(value)}
                                        onCheckedChange={(checked) =>
                                            toggleStatus(value, checked as boolean)
                                        }
                                    />
                                    <Label
                                        htmlFor={`assign-status-${value}`}
                                        className="cursor-pointer"
                                    >
                                        {label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Max Leads */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="maxLeads"
                            className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
                        >
                            Max Leads to Assign
                        </Label>
                        <Input
                            id="maxLeads"
                            type="number"
                            value={maxLeads}
                            onChange={(e) => setMaxLeads(parseInt(e.target.value) || 1000)}
                            min={1}
                            max={10000}
                        />
                    </div>

                    {/* Preview */}
                    <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Matching leads:</span>
                                {isLoadingPreview ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : leadTypes.length === 0 || leadStatuses.length === 0 ? (
                                    <span className="text-sm text-muted-foreground">
                                        Select criteria
                                    </span>
                                ) : (
                                    <span className="font-bold font-mono">
                                        {previewCount.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={
                            isAssigning ||
                            leadTypes.length === 0 ||
                            leadStatuses.length === 0 ||
                            previewCount === 0
                        }
                    >
                        {isAssigning ? (
                            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                        ) : (
                            <UserPlus className="mr-2 h-4 w-4" />
                        )}
                        Assign {previewCount > 0 ? previewCount.toLocaleString() : ''} Leads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
