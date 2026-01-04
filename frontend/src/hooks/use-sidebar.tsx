import { useEffect, useState } from "react";

const SIDEBAR_COOKIE_NAME = "sidebar:state";

export function useSidebar() {
	const [isCollapsed, setIsCollapsed] = useState(false);

	useEffect(() => {
		const storedState = localStorage.getItem(SIDEBAR_COOKIE_NAME);
		if (storedState) {
			setIsCollapsed(JSON.parse(storedState));
		}
	}, []);

	const toggleSidebar = () => {
		const newState = !isCollapsed;
		setIsCollapsed(newState);
		localStorage.setItem(SIDEBAR_COOKIE_NAME, JSON.stringify(newState));
	};

	return {
		isCollapsed,
		toggleSidebar,
	};
}
