/**
 * Query Key Factory
 *
 * Centralized source of truth for all React Query keys.
 * Ensures type safety and consistent cache invalidation across the application.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
 */
export const authKeys = {
	all: ["auth"] as const,
	session: () => [...authKeys.all, "session"] as const,
	account: () => [...authKeys.all, "account"] as const,
	syncAvatar: (userId?: string) => [...authKeys.all, "sync-avatar", userId] as const,
};

export const leadsKeys = {
	all: ["leads"] as const,
	list: (page: number, limit: number, search?: string) =>
		[...leadsKeys.all, "list", { page, limit, search }] as const,
	detail: (id: string) => [...leadsKeys.all, "detail", id] as const,
};

export const campaignKeys = {
	all: ["campaign"] as const,
	active: () => [...campaignKeys.all, "active"] as const,
	list: () => [...campaignKeys.all, "list"] as const,
};

export const settingsKeys = {
	all: ["settings"] as const,
};

export const logsKeys = {
	all: ["logs"] as const,
	recent: () => [...logsKeys.all, "recent"] as const,
};
