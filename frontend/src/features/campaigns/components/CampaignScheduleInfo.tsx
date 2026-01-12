/**
 * CampaignScheduleInfo Component
 *
 * Display schedule configuration for a campaign.
 */

import { format } from 'date-fns';
import { Clock, Calendar, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ScheduleConfig } from '../types';

interface CampaignScheduleInfoProps {
    schedule: ScheduleConfig;
}

/**
 * Format time from hour/minute to display string
 */
function formatTime(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function CampaignScheduleInfo({ schedule }: CampaignScheduleInfoProps) {
    return (
        <div className="space-y-6">
            {/* Time Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Working Hours */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Working Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold font-mono">
                            {formatTime(
                                schedule.workingHours.startHour,
                                schedule.workingHours.startMinute
                            )}{' '}
                            -{' '}
                            {formatTime(
                                schedule.workingHours.endHour,
                                schedule.workingHours.endMinute
                            )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Emails sent only during these hours
                        </p>
                    </CardContent>
                </Card>

                {/* Peak Hours */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Peak Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold font-mono">
                            {schedule.peakHours.startHour.toString().padStart(2, '0')}:00 -{' '}
                            {schedule.peakHours.endHour.toString().padStart(2, '0')}:00
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Higher send rate ({schedule.peakHours.peakMultiplier}x)
                        </p>
                    </CardContent>
                </Card>

                {/* Timezone */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Timezone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-medium">{schedule.timezone}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            All times in this timezone
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Volume Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono uppercase">Daily Limit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold font-mono">{schedule.dailyLimit}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Maximum emails per day
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono uppercase">Batch Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold font-mono">{schedule.batchSize}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Emails per processing cycle
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Scheduled Dates */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Scheduled Dates ({schedule.scheduledDates.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {schedule.scheduledDates.length === 0 ? (
                        <p className="text-muted-foreground">No dates scheduled</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {schedule.scheduledDates
                                .map((d) => new Date(d))
                                .sort((a, b) => a.getTime() - b.getTime())
                                .map((date) => (
                                    <Badge
                                        key={date.toISOString()}
                                        variant="secondary"
                                        className="font-mono text-xs"
                                    >
                                        {format(date, 'EEE, MMM d, yyyy')}
                                    </Badge>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
