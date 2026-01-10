/**
 * Leads API Hooks
 *
 * TanStack Query hooks for leads and staging leads API.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
    Lead,
    StagedLead,
    LeadsResponse,
    StagedLeadsResponse,
    StageLeadsRequest,
    StageLeadsResponse,
    ApproveLeadResponse,
    BatchApproveResponse,
} from '../types';

// API Base URL - configure based on environment
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// =============================================================================
// Leads Queries
// =============================================================================

export function useLeads(params?: { limit?: number; lastKey?: string; status?: string }) {
    return useQuery({
        queryKey: ['leads', params],
        queryFn: async (): Promise<LeadsResponse> => {
            const searchParams = new URLSearchParams();
            if (params?.limit) searchParams.set('limit', String(params.limit));
            if (params?.lastKey) searchParams.set('lastKey', params.lastKey);
            if (params?.status) searchParams.set('status', params.status);

            const response = await fetch(`${API_BASE}/leads?${searchParams}`);
            if (!response.ok) throw new Error('Failed to fetch leads');
            return response.json();
        },
    });
}

export function useLead(id: string) {
    return useQuery({
        queryKey: ['leads', id],
        queryFn: async (): Promise<{ success: boolean; data: Lead }> => {
            const response = await fetch(`${API_BASE}/leads/${id}`);
            if (!response.ok) throw new Error('Failed to fetch lead');
            return response.json();
        },
        enabled: !!id,
    });
}

// =============================================================================
// Staging Leads Queries
// =============================================================================

export function useStagedLeads(params?: { limit?: number; lastKey?: string; status?: string }) {
    return useQuery({
        queryKey: ['staged-leads', params],
        queryFn: async (): Promise<StagedLeadsResponse> => {
            const searchParams = new URLSearchParams();
            if (params?.limit) searchParams.set('limit', String(params.limit));
            if (params?.lastKey) searchParams.set('lastKey', params.lastKey);
            if (params?.status) searchParams.set('status', params.status);

            const response = await fetch(`${API_BASE}/leads/staging?${searchParams}`);
            if (!response.ok) throw new Error('Failed to fetch staged leads');
            return response.json();
        },
    });
}

export function useStagedLead(id: string) {
    return useQuery({
        queryKey: ['staged-leads', id],
        queryFn: async (): Promise<{ success: boolean; data: StagedLead }> => {
            const response = await fetch(`${API_BASE}/leads/staging/${id}`);
            if (!response.ok) throw new Error('Failed to fetch staged lead');
            return response.json();
        },
        enabled: !!id,
    });
}

// =============================================================================
// Staging Mutations
// =============================================================================

export function useStageLeads() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: StageLeadsRequest): Promise<StageLeadsResponse> => {
            const response = await fetch(`${API_BASE}/leads/staging`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to stage leads');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staged-leads'] });
        },
    });
}

export function useValidateLeads() {
    return useMutation({
        mutationFn: async (data: StageLeadsRequest) => {
            const response = await fetch(`${API_BASE}/leads/staging/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to validate leads');
            return response.json();
        },
    });
}

export function useApproveLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string): Promise<ApproveLeadResponse> => {
            const response = await fetch(`${API_BASE}/leads/staging/${id}/approve`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to approve lead');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staged-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

export function useBatchApproveLeads() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { ids: string[]; approveValidatedOnly?: boolean }): Promise<BatchApproveResponse> => {
            const response = await fetch(`${API_BASE}/leads/staging/approve-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to batch approve leads');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staged-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

export function useDeleteStagedLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE}/leads/staging/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete staged lead');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staged-leads'] });
        },
    });
}

export function useUpdateStagedLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<StagedLead> }) => {
            const response = await fetch(`${API_BASE}/leads/staging/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to update staged lead');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staged-leads'] });
        },
    });
}

// =============================================================================
// Leads Mutations
// =============================================================================

export function useCreateLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
            const response = await fetch(`${API_BASE}/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to create lead');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

export function useUpdateLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) => {
            const response = await fetch(`${API_BASE}/leads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to update lead');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

export function useDeleteLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE}/leads/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete lead');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

// =============================================================================
// Export
// =============================================================================

export function useExportLeads() {
    return useMutation({
        mutationFn: async (params?: { campaignId?: string; status?: string }) => {
            const response = await fetch(`${API_BASE}/leads/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params || {}),
            });
            if (!response.ok) throw new Error('Failed to export leads');
            const result = await response.json();

            // Trigger download
            const link = document.createElement('a');
            link.href = `data:${result.contentType};base64,${result.data}`;
            link.download = result.filename;
            link.click();

            return result;
        },
    });
}

export function useDownloadTemplate() {
    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`${API_BASE}/leads/export/template`);
            if (!response.ok) throw new Error('Failed to download template');
            const result = await response.json();

            // Trigger download
            const link = document.createElement('a');
            link.href = `data:${result.contentType};base64,${result.data}`;
            link.download = result.filename;
            link.click();

            return result;
        },
    });
}
