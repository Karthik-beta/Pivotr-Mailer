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
