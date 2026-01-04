import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { account } from "@/lib/appwrite";

// Query Keys
export const AUTH_KEYS = {
	session: ["auth", "session"],
	account: ["auth", "account"],
} as const;

export function useUser() {
	return useQuery({
		queryKey: AUTH_KEYS.account,
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
			await account.deleteSession("current");
		},
		onSuccess: () => {
			queryClient.setQueryData(AUTH_KEYS.account, null);
			queryClient.invalidateQueries({ queryKey: AUTH_KEYS.account });
			navigate({ to: "/login" });
		},
	});
}

export function useSyncGoogleAvatar() {
	const { data: user } = useUser();
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: ["auth", "sync-avatar", user?.$id],
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
					await queryClient.invalidateQueries({ queryKey: AUTH_KEYS.account });
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
