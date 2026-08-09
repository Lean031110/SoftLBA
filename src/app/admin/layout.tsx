import { PanelLayout } from '@/components/layout/panel-layout'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PanelLayout>{children}</PanelLayout>
}
