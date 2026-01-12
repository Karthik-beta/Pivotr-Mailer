/**
 * StepBasicInfo Component
 *
 * Step 1 of the campaign wizard - Basic campaign information.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CampaignFormData } from '../CampaignWizard';

interface StepBasicInfoProps {
    data: CampaignFormData;
    onChange: (data: Partial<CampaignFormData>) => void;
    errors: Record<string, string>;
}

export function StepBasicInfo({ data, onChange, errors }: StepBasicInfoProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label
                    htmlFor="name"
                    className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
                >
                    Campaign Name *
                </Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder="Q1 Hardware Outreach"
                    className="font-medium"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
                <Label
                    htmlFor="description"
                    className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
                >
                    Description (Optional)
                </Label>
                <Textarea
                    id="description"
                    value={data.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="Campaign targeting hardware leads in Q1..."
                    rows={3}
                />
                {errors.description && (
                    <p className="text-sm text-destructive">{errors.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                    A brief description to help you identify this campaign later.
                </p>
            </div>
        </div>
    );
}
