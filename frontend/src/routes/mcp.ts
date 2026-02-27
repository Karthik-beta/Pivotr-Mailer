import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createFileRoute } from "@tanstack/react-router";
import { addTodo } from "@/mcp-todos";
import { handleMcpRequest } from "@/utils/mcp-handler";

const server = new McpServer({
	name: "start-server",
	version: "1.0.0",
});

server.tool("addTodo", "Add an example todo to a list of todos", () => ({
	content: [{ type: "text", text: String(addTodo("Example todo")) }],
}));

// server.registerResource(
//   "counter-value",
//   "count://",
//   {
//     title: "Counter Resource",
//     description: "Returns the current value of the counter",
//   },
//   async (uri) => {
//     return {
//       contents: [
//         {
//           uri: uri.href,
//           text: `The counter is at 20!`,
//         },
//       ],
//     };
//   }
// );

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			POST: async ({ request }) => handleMcpRequest(request, server),
		},
	},
});
