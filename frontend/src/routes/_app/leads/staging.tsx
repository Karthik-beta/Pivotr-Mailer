/**
 * Staging Leads Page
 *
 * Premium staging area for leads awaiting approval.
 * Features:
 * - Import leads via file upload or paste
 * - View validation errors and warnings
 * - Edit invalid leads before approval
 * - Batch approve validated leads
 * - URL-driven state for table filtering and pagination
 */

import { useState, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Layout } from '@/features/shared/Layout';
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Upload,
    FileSpreadsheet,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ClipboardPaste,
    RefreshCw,
    Trash2,
    Check,
    ArrowLeft,
    Loader2,
    FileUp,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    useStagedLeads,
    useStageLeads,
    useApproveLead,
    useBatchApproveLeads,
    useDeleteStagedLead,
    useUpdateStagedLead,
    useDownloadTemplate,
} from '@/features/leads/hooks/useLeads';
import { StagingLeadsDataTable } from '@/features/leads/components/StagingLeadsDataTable';
import type { StagedLead, StageLeadsRequest, StagingStatus } from '@/features/leads/types';

// Search params schema for URL-driven table state
const stagingSearchSchema = z.object({
    status: z.string().optional().default('all'),
    page: z.number().optional().default(0),
    pageSize: z.number().optional().default(10),
});

export const Route = createFileRoute('/_app/leads/staging')({
    component: StagingLeadsPage,
    validateSearch: stagingSearchSchema,
});

function StagingLeadsPage() {
    const navigate = useNavigate();
    const { status, page, pageSize } = Route.useSearch();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'review' | 'import'>('review');
    const [pasteData, setPasteData] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [confirmApproveAll, setConfirmApproveAll] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const { data, isLoading, error, refetch, isRefetching } = useStagedLeads({ limit: 100 });
    const stageLeadsMutation = useStageLeads();
    const approveMutation = useApproveLead();
    const batchApproveMutation = useBatchApproveLeads();
    const deleteMutation = useDeleteStagedLead();
    const updateMutation = useUpdateStagedLead();
    const templateMutation = useDownloadTemplate();

    const stagedLeads = data?.data || [];

    // URL state update handlers
    const handleStatusFilterChange = (newStatus: string) => {
        navigate({
            search: (prev) => ({ ...prev, status: newStatus, page: 0 }),
            replace: true,
        });
    };

    const handlePageSizeChange = (newPageSize: number) => {
        navigate({
            search: (prev) => ({ ...prev, pageSize: newPageSize, page: 0 }),
            replace: true,
        });
    };

    const handlePageIndexChange = (newPageIndex: number) => {
        navigate({
            search: (prev) => ({ ...prev, page: newPageIndex }),
            replace: true,
        });
    };

    // Calculate stats
    const stats = {
        total: stagedLeads.length,
        valid: stagedLeads.filter((l) => l.validationResult.valid).length,
        invalid: stagedLeads.filter((l) => !l.validationResult.valid).length,
        pending: stagedLeads.filter((l) => l.status === 'PENDING_REVIEW').length,
        validated: stagedLeads.filter((l) => l.status === 'VALIDATED').length,
    };

    const handleApprove = useCallback(
        (id: string) => {
            approveMutation.mutate(id, {
                onSuccess: () => {
                    toast.success('Lead approved successfully');
                },
                onError: (error) => {
                    toast.error(`Failed to approve lead: ${error.message}`);
                },
            });
        },
        [approveMutation]
    );

    const handleBatchApprove = useCallback(
        (ids: string[], validatedOnly = false) => {
            batchApproveMutation.mutate(
                { ids, approveValidatedOnly: validatedOnly },
                {
                    onSuccess: (result) => {
                        toast.success(
                            `Approved ${result.data.approved} leads${
                                result.data.skipped > 0 ? `, ${result.data.skipped} skipped` : ''
                            }`
                        );
                        setSelectedIds([]);
                        setConfirmApproveAll(false);
                    },
                    onError: (error) => {
                        toast.error(`Batch approve failed: ${error.message}`);
                    },
                }
            );
        },
        [batchApproveMutation]
    );

    const handleDelete = useCallback(
        (id: string) => {
            deleteMutation.mutate(id, {
                onSuccess: () => {
                    toast.success('Lead deleted');
                    setConfirmDelete(null);
                },
                onError: (error) => {
                    toast.error(`Failed to delete lead: ${error.message}`);
                },
            });
        },
        [deleteMutation]
    );

    const handleUpdate = useCallback(
        (id: string, updateData: Partial<StagedLead>) => {
            updateMutation.mutate(
                { id, data: updateData },
                {
                    onSuccess: () => {
                        toast.success('Lead updated');
                    },
                    onError: (error) => {
                        toast.error(`Failed to update lead: ${error.message}`);
                    },
                }
            );
        },
        [updateMutation]
    );

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile(file);
        }
    };

    const parseCSV = (text: string): StageLeadsRequest['leads'] => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const leads: StageLeadsRequest['leads'] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map((v) => v.trim());
            if (values.length < 3) continue;

            const lead: StageLeadsRequest['leads'][0] = {
                fullName: values[headers.indexOf('fullname')] || values[headers.indexOf('name')] || values[0],
                email: values[headers.indexOf('email')] || values[1],
                companyName: values[headers.indexOf('companyname')] || values[headers.indexOf('company')] || values[2],
                phoneNumber: values[headers.indexOf('phonenumber')] || values[headers.indexOf('phone')] || values[3],
            };

            if (lead.fullName && lead.email && lead.companyName) {
                leads.push(lead);
            }
        }

        return leads;
    };

    const handleImportFromPaste = () => {
        const leads = parseCSV(pasteData);
        if (leads.length === 0) {
            toast.error('No valid leads found in pasted data');
            return;
        }

        stageLeadsMutation.mutate(
            { leads },
            {
                onSuccess: (result) => {
                    toast.success(
                        `Staged ${result.data.stagedCount} leads (${result.data.validCount} valid, ${result.data.invalidCount} invalid)`
                    );
                    setPasteData('');
                    setActiveTab('review');
                },
                onError: (error) => {
                    toast.error(`Import failed: ${error.message}`);
                },
            }
        );
    };

    const handleImportFromFile = async () => {
        if (!uploadedFile) return;

        const text = await uploadedFile.text();
        const leads = parseCSV(text);

        if (leads.length === 0) {
            toast.error('No valid leads found in file');
            return;
        }

        stageLeadsMutation.mutate(
            { leads },
            {
                onSuccess: (result) => {
                    toast.success(
                        `Staged ${result.data.stagedCount} leads (${result.data.validCount} valid, ${result.data.invalidCount} invalid)`
                    );
                    setUploadedFile(null);
                    setActiveTab('review');
                },
                onError: (error) => {
                    toast.error(`Import failed: ${error.message}`);
                },
            }
        );
    };

    return (
        <Layout
            breadcrumbs={
                <>
                    <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink href="/">Pivotr Mailer</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/leads">Leads</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Staging</BreadcrumbPage>
                    </BreadcrumbItem>
                </>
            }
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild className="-ml-2">
                                <a href="/leads">
                                    <ArrowLeft className="h-4 w-4" />
                                </a>
                            </Button>
                            <h1 className="text-3xl font-bold tracking-tight">Staging Area</h1>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Review and validate leads before importing to your main database.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isRefetching}
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => templateMutation.mutate()}
                            disabled={templateMutation.isPending}
                        >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Template
                        </Button>
                        {selectedIds.length > 0 && (
                            <Button
                                size="sm"
                                onClick={() => handleBatchApprove(selectedIds, false)}
                                disabled={batchApproveMutation.isPending}
                            >
                                {batchApproveMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                )}
                                Approve Selected ({selectedIds.length})
                            </Button>
                        )}
                        {stats.valid > 0 && (
                            <Button
                                size="sm"
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => setConfirmApproveAll(true)}
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve All Valid ({stats.valid})
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Staged</CardTitle>
                            <FileUp className="h-4 w-4 text-slate-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground">Awaiting review</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Valid</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                {stats.valid}
                            </div>
                            <p className="text-xs text-emerald-600/70">Ready to approve</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Invalid</CardTitle>
                            <AlertCircle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                                {stats.invalid}
                            </div>
                            <p className="text-xs text-red-600/70">Needs correction</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                {stats.pending}
                            </div>
                            <p className="text-xs text-amber-600/70">Not yet reviewed</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Validated</CardTitle>
                            <Check className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {stats.validated}
                            </div>
                            <p className="text-xs text-blue-600/70">Passed validation</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'review' | 'import')}>
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="review">
                            Review Leads ({stats.total})
                        </TabsTrigger>
                        <TabsTrigger value="import">
                            Import New Leads
                        </TabsTrigger>
                    </TabsList>

                    {/* Review Tab */}
                    <TabsContent value="review" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Staged Leads</CardTitle>
                                <CardDescription>
                                    Review validation results. Click the expand icon to see detailed validation
                                    information. Edit any lead to correct data before approval.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {stats.invalid > 0 && (
                                    <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Validation Issues Found</AlertTitle>
                                        <AlertDescription>
                                            {stats.invalid} lead(s) have validation errors. Click on a lead to
                                            expand and see details, then use the edit button to correct the data.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <StagingLeadsDataTable
                                    data={stagedLeads}
                                    isLoading={isLoading}
                                    error={error}
                                    onRetry={() => refetch()}
                                    onApprove={handleApprove}
                                    onDelete={(id) => setConfirmDelete(id)}
                                    onUpdate={handleUpdate}
                                    onSelectionChange={setSelectedIds}
                                    isApproving={approveMutation.isPending}
                                    isDeleting={deleteMutation.isPending}
                                    statusFilter={status as StagingStatus | 'all'}
                                    onStatusFilterChange={handleStatusFilterChange}
                                    pageSize={pageSize}
                                    onPageSizeChange={handlePageSizeChange}
                                    pageIndex={page}
                                    onPageIndexChange={handlePageIndexChange}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Import Tab */}
                    <TabsContent value="import" className="mt-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* File Upload */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Upload className="h-5 w-5" />
                                        Upload CSV File
                                    </CardTitle>
                                    <CardDescription>
                                        Upload a CSV file with columns: fullName, email, companyName, phoneNumber
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="file">CSV File</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="file"
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={handleFileUpload}
                                                    className="flex-1"
                                                />
                                                {uploadedFile && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setUploadedFile(null)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {uploadedFile && (
                                            <div className="p-3 rounded-lg bg-muted">
                                                <p className="text-sm font-medium">{uploadedFile.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(uploadedFile.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        )}
                                        <Button
                                            onClick={handleImportFromFile}
                                            disabled={!uploadedFile || stageLeadsMutation.isPending}
                                        >
                                            {stageLeadsMutation.isPending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Upload className="mr-2 h-4 w-4" />
                                            )}
                                            Import from File
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Paste Data */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardPaste className="h-5 w-5" />
                                        Paste CSV Data
                                    </CardTitle>
                                    <CardDescription>
                                        Paste CSV data directly. First row should be headers.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="paste">CSV Data</Label>
                                            <Textarea
                                                id="paste"
                                                placeholder={`fullName,email,companyName,phoneNumber\nRajesh Kumar,rajesh@example.com,Tech Corp,9876543210`}
                                                value={pasteData}
                                                onChange={(e) => setPasteData(e.target.value)}
                                                className="min-h-[150px] font-mono text-sm"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleImportFromPaste}
                                            disabled={!pasteData.trim() || stageLeadsMutation.isPending}
                                        >
                                            {stageLeadsMutation.isPending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <ClipboardPaste className="mr-2 h-4 w-4" />
                                            )}
                                            Import from Paste
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Tips */}
                        <Alert className="mt-6">
                            <FileSpreadsheet className="h-4 w-4" />
                            <AlertTitle>Import Tips</AlertTitle>
                            <AlertDescription className="mt-2">
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Use the Excel template for consistent formatting</li>
                                    <li>Names should include first and last name for best validation</li>
                                    <li>Indian phone numbers should include country code (+91) or be 10 digits</li>
                                    <li>Corporate email addresses are preferred for B2B leads</li>
                                    <li>All leads will be validated before staging</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Confirm Approve All Dialog */}
            <Dialog open={confirmApproveAll} onOpenChange={setConfirmApproveAll}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve All Valid Leads?</DialogTitle>
                        <DialogDescription>
                            This will approve {stats.valid} valid lead(s) and import them to your main leads
                            database. Invalid leads will be skipped.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmApproveAll(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                                const validIds = stagedLeads
                                    .filter((l) => l.validationResult.valid)
                                    .map((l) => l.id);
                                handleBatchApprove(validIds, true);
                            }}
                            disabled={batchApproveMutation.isPending}
                        >
                            {batchApproveMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Approve All Valid
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Staged Lead?</DialogTitle>
                        <DialogDescription>
                            This will permanently remove this lead from staging. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => confirmDelete && handleDelete(confirmDelete)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete Lead
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
