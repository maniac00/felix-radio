// import { UserButton } from '@clerk/nextjs'; // Temporarily disabled for demo
import Link from 'next/link';
import { Home, Calendar, Radio, Settings, User } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { name: '대시보드', href: '/dashboard', icon: Home },
    { name: '스케줄', href: '/dashboard/schedules', icon: Calendar },
    { name: '녹음 목록', href: '/dashboard/recordings', icon: Radio },
    { name: '설정', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🐱</span>
            <h1 className="text-xl font-bold text-navy">Felix Radio</h1>
          </div>
          <div className="flex items-center space-x-2 text-gray-600">
            <User className="w-5 h-5" />
            <span className="text-sm">Demo User</span>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-orange/10 hover:text-orange transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
