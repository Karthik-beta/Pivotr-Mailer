import type { RealtimeResponseEvent } from "appwrite";
import { useEffect } from "react";
import { client } from "@/lib/appwrite";

export function useRealtimeSubscription<T>(
	channels: string | string[],
	callback: (payload: RealtimeResponseEvent<T>) => void,
	enabled: boolean = true
) {
	useEffect(() => {
		if (!enabled) return;

		const unsubscribe = client.subscribe(channels, (response) => {
			callback(response as RealtimeResponseEvent<T>);
		});

		return () => {
			unsubscribe();
		};
	}, [channels, callback, enabled]);
}
