import { Sidebar } from "@/app/(ui)/components/sidebar"

export const dynamic = 'force-dynamic'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8 pt-10">{children}</main>
    </div>
  )
}

