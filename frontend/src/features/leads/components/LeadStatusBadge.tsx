/**
 * Lead Status Badge Component
 *
 * Displays lead status with semantic coloring.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LeadStatus, StagingStatus } from '../types';
import { STATUS_COLORS, STAGING_STATUS_COLORS } from '../types';

interface LeadStatusBadgeProps {
    status: LeadStatus;
    className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
    const colors = STATUS_COLORS[status] || STATUS_COLORS.PENDING_IMPORT;

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-medium border px-2.5 py-0.5 text-xs',
                colors.bg,
                colors.text,
                colors.border,
                className
            )}
        >
            {status.replace(/_/g, ' ')}
        </Badge>
    );
}

interface StagingStatusBadgeProps {
    status: StagingStatus;
    className?: string;
}

export function StagingStatusBadge({ status, className }: StagingStatusBadgeProps) {
    const colors = STAGING_STATUS_COLORS[status] || STAGING_STATUS_COLORS.PENDING_REVIEW;

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-medium border px-2.5 py-0.5 text-xs',
                colors.bg,
                colors.text,
                colors.border,
                className
            )}
        >
            {status.replace(/_/g, ' ')}
        </Badge>
    );
}

interface ValidationConfidenceBadgeProps {
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    className?: string;
}

export function ValidationConfidenceBadge({ confidence, className }: ValidationConfidenceBadgeProps) {
    const colors = {
        HIGH: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
        MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
        LOW: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    };

    const color = colors[confidence];

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-medium border px-2 py-0.5 text-xs',
                color.bg,
                color.text,
                color.border,
                className
            )}
        >
            {confidence}
        </Badge>
    );
}
