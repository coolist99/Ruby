import { useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo, ToastProvider } from './components/common'
import { useDBReady } from './lib/db'
import { Sidebar } from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import DailyClasses from './pages/DailyClasses'
import Queued from './pages/Queued'
import Attendance from './pages/Attendance'
import StudentReport from './pages/StudentReport'

function Layout() {
  const [drawer, setDrawer] = useState(false)
  const ready = useDBReady()
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex animate-pop flex-col items-center gap-3">
          <div className="animate-pulse">
            <Logo size={56} />
          </div>
          <div className="text-sm font-semibold text-muted">Ruby's Room 加载中…</div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-screen">
      {/* 桌面侧边栏 */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 border-r border-line bg-lavender/60 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>

      {/* 移动端抽屉 */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade bg-[#2a2140]/30 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[280px] animate-rise bg-lavender shadow-pop">
            <button
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-black/5"
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* 主内容 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶栏 */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-cream/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setDrawer(true)}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-ink shadow-sm"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-bold text-ink">Ruby's Room</span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="daily" element={<DailyClasses />} />
          <Route path="queued" element={<Queued />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="student/:id" element={<StudentReport />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}
