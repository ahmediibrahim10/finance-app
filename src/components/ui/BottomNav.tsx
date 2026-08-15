"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, PlusCircle, PieChart, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/transactions', icon: List, label: 'Transactions' },
    { href: '/add', icon: PlusCircle, label: 'Add', special: true },
    { href: '/budget', icon: PieChart, label: 'Budget' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-lg border-t border-gray-200 pb-safe pt-2 px-4 z-50">
      <ul className="flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.special) {
            return (
              <li key={item.href} className="flex-shrink-0 -mt-8">
                <Link href={item.href} className="flex flex-col items-center">
                  <div className="bg-black text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform">
                    <Icon size={28} />
                  </div>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link href={item.href} className="flex flex-col items-center p-2 active:scale-95 transition-transform">
                <Icon 
                  size={24} 
                  className={isActive ? "text-black" : "text-gray-400"} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                <span className={`text-[10px] mt-1 ${isActive ? "text-black font-semibold" : "text-gray-400"}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}