import { createFileRoute } from '@tanstack/react-router'

import DashboardPage from '../../features/dashboard/page'
export const Route = createFileRoute('/_app/')({ component: App })

function App() {
  return <DashboardPage />
}
