import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { account } from "@/lib/appwrite";

import { authKeys } from "@/lib/query-keys";

// Query Keys removed in favor of factory

/**
 * Logout State Management
 * 
 * Uses module-level state shared between RootLayout and AuthGuard to ensure
 * seamless logout transitions. During logout:
 * 1. isLoggingOut=true triggers immediately when logout starts
 * 2. RootLayout renders loader (no Outlet to prevent content flash)
 * 3. On reaching /login, isTransitioning=true starts the transition sequence
 * 4. After paint cycles complete, states reset and login page appears
 */
let isLoggingOutState = false;
let isTransitioningState = false;
const listeners = new Set<() => void>();

function notifyListeners() {
	for (const listener of listeners) {
		listener();
	}
}

function setLoggingOut(value: boolean) {
	isLoggingOutState = value;
	notifyListeners();
}

export function setTransitioning(value: boolean) {
	isTransitioningState = value;
	notifyListeners();
}

// Export for AuthGuard to reset when login page renders
export function resetLogoutState() {
	setLoggingOut(false);
}

export function useLogoutState() {
	return useSyncExternalStore(
		(callback) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		() => isLoggingOutState,
		() => false // Server snapshot - always false on SSR
	);
}

export function useTransitioningState() {
	return useSyncExternalStore(
		(callback) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		() => isTransitioningState,
		() => false // Server snapshot - always false on SSR
	);
}

export function useUser() {
	return useQuery({
		queryKey: authKeys.account(),
		queryFn: async () => {
			try {
				return await account.get();
			} catch (_error) {
				return null;
			}
		},
		// Don't refetch on window focus for auth state to prevent thrashing
		refetchOnWindowFocus: false,
		retry: false,
	});
}

export function useLogout() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation({
		mutationFn: async () => {
			setLoggingOut(true);
			await account.deleteSession("current");
		},
		onSuccess: () => {
			queryClient.setQueryData(authKeys.account(), null);
			queryClient.invalidateQueries({ queryKey: authKeys.account() });
			navigate({ to: "/login" });
		},
		onError: () => {
			setLoggingOut(false);
		},
	});
}

export function useSyncGoogleAvatar() {
	const { data: user } = useUser();
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: authKeys.syncAvatar(user?.$id),
		queryFn: async () => {
			if (!user) return null;
			if (user.prefs.avatar) return null; // Avatar already exists

			try {
				const session = await account.getSession("current");
				if (session.provider !== "google") return null;

				const res = await fetch(
					`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${session.providerAccessToken}`
				);

				if (!res.ok) {
					// Silent failure is okay here, we just won't get the avatar
					return null;
				}

				const googleProfile = await res.json();
				const picture = googleProfile.picture;

				if (picture) {
					await account.updatePrefs({
						prefs: {
							...user.prefs,
							avatar: picture,
						},
					});
					await queryClient.invalidateQueries({ queryKey: authKeys.account() });
					return picture;
				}
			} catch (error) {
				console.error("Failed to sync Google avatar:", error);
			}

			return null;
		},
		enabled: !!user && !user.prefs?.avatar,
		refetchOnWindowFocus: false,
		refetchOnMount: true,
		staleTime: 1000 * 60 * 60 * 24, // 24 hours
	});
}
