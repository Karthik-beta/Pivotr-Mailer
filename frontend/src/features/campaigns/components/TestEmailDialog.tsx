/**
 * TestEmailDialog Component
 *
 * Dialog for sending a test email from a campaign.
 */

import { useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
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
import { useSendTestEmail } from '../hooks/useCampaigns';

interface TestEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string;
}

export function TestEmailDialog({ open, onOpenChange, campaignId }: TestEmailDialogProps) {
    const [testEmail, setTestEmail] = useState('');
    const sendTestMutation = useSendTestEmail();

    const handleSendTest = async () => {
        if (!testEmail.trim()) {
            toast.error('Please enter a recipient email');
            return;
        }

        try {
            await sendTestMutation.mutateAsync({
                id: campaignId,
                recipientEmail: testEmail,
            });
            toast.success('Test email sent successfully!');
            onOpenChange(false);
            setTestEmail('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to send test email');
        }
    };

    const isSending = sendTestMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send Test Email</DialogTitle>
                    <DialogDescription>
                        Send a test email to preview how the campaign will look.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label
                            htmlFor="testEmail"
                            className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
                        >
                            Recipient Email
                        </Label>
                        <Input
                            id="testEmail"
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="your@email.com"
                        />
                        <p className="text-xs text-muted-foreground">
                            The test email will use sample variable values.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSendTest} disabled={!testEmail.trim() || isSending}>
                        {isSending ? (
                            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Send Test
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
