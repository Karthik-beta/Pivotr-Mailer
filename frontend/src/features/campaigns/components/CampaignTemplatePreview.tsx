/**
 * CampaignTemplatePreview Component
 *
 * Display the email template for a campaign including sign-off section.
 */

import { marked } from 'marked';
import { Linkedin, Twitter, Globe, Mail, Phone, Image as ImageIcon } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EmailTemplate } from '../types';

interface CampaignTemplatePreviewProps {
    template: EmailTemplate;
}

// Platform icons
const PLATFORM_ICONS = {
    linkedin: Linkedin,
    twitter: Twitter,
    website: Globe,
    email: Mail,
    phone: Phone,
};

/**
 * Parse markdown to HTML with full syntax support
 */
function parseMarkdown(text: string): string {
    if (!text) return '';

    // Configure marked for full markdown support
    marked.setOptions({
        breaks: true,      // Convert \n to <br>
        gfm: true,         // GitHub Flavored Markdown
    });

    return marked.parse(text, { async: false }) as string;
}

export function CampaignTemplatePreview({ template }: CampaignTemplatePreviewProps) {
    return (
        <div className="space-y-6">
            {/* Sender Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-mono uppercase text-muted-foreground">Sender Name</p>
                    <p className="font-medium">{template.senderName}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-mono uppercase text-muted-foreground">Sender Email</p>
                    <p className="font-medium font-mono">{template.senderEmail}</p>
                </div>
                {template.ccEmail && (
                    <div className="space-y-1">
                        <p className="text-xs font-mono uppercase text-muted-foreground">CC Email</p>
                        <p className="font-medium font-mono">{template.ccEmail}</p>
                    </div>
                )}
            </div>

            {/* Email Preview */}
            <Card className="bg-muted/50">
                <CardHeader className="pb-2 border-b space-y-1">
                    <div className="font-mono text-xs text-muted-foreground">
                        From: {template.senderName} &lt;{template.senderEmail}&gt;
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                        To: {'{{recipient@email.com}}'}
                    </div>
                    {template.ccEmail && (
                        <div className="font-mono text-xs text-muted-foreground">
                            CC: {template.ccEmail}
                        </div>
                    )}
                    <div className="font-semibold pt-2">{template.subject}</div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    {/* Email Body */}
                    <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(template.body) }}
                    />

                    {/* Sign-off Section */}
                    {template.signOff?.enabled && (
                        <div className="border-t pt-4 space-y-3">
                            {/* Markdown Content */}
                            {template.signOff.content && (
                                <div
                                    className="prose prose-sm max-w-none dark:prose-invert"
                                    dangerouslySetInnerHTML={{ __html: parseMarkdown(template.signOff.content) }}
                                />
                            )}

                            {/* Media */}
                            {template.signOff.media && template.signOff.media.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {template.signOff.media.map((media, index) => (
                                        <div key={index} className="relative">
                                            {media.url ? (
                                                media.link ? (
                                                    <a href={media.link} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={media.url}
                                                            alt={media.alt || `${media.type} ${index + 1}`}
                                                            style={{ width: media.width ? `${media.width}px` : 'auto', maxWidth: '200px' }}
                                                            className="rounded border"
                                                        />
                                                    </a>
                                                ) : (
                                                    <img
                                                        src={media.url}
                                                        alt={media.alt || `${media.type} ${index + 1}`}
                                                        style={{ width: media.width ? `${media.width}px` : 'auto', maxWidth: '200px' }}
                                                        className="rounded border"
                                                    />
                                                )
                                            ) : (
                                                <div className="w-24 h-24 bg-muted rounded border flex items-center justify-center">
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                            )}
                                            <Badge
                                                variant="secondary"
                                                className="absolute -top-2 -right-2 text-[10px] px-1"
                                            >
                                                {media.type}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Social Links */}
                            {template.signOff.socialLinks && template.signOff.socialLinks.length > 0 && (
                                <div className="flex flex-wrap gap-3 pt-2">
                                    {template.signOff.socialLinks.map((link, index) => {
                                        const Icon = PLATFORM_ICONS[link.platform];
                                        return (
                                            <a
                                                key={index}
                                                href={link.platform === 'email' ? `mailto:${link.url}` : link.platform === 'phone' ? `tel:${link.url}` : link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                            >
                                                <Icon className="h-4 w-4" />
                                                {link.label || link.platform}
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Spintax Notice */}
            <p className="text-xs text-muted-foreground">
                Note: The subject and body may contain Spintax (e.g., {'{Hi|Hello}'}) which will be
                randomly resolved when sending. Variables like {'{{FirstName}}'} will be replaced
                with lead data.
            </p>
        </div>
    );
}
