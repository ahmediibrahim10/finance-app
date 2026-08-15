"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Plus, PieChart, Settings } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  
  const navItems = [
    { href: "/", icon: Home },
    { href: "/transactions", icon: Receipt },
    { href: "/add", icon: Plus, isFab: true },
    { href: "/analytics", icon: PieChart },
    { href: "/settings", icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 pb-safe pt-3 px-6 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
      {navItems.map((item, index) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.isFab) {
          return (
            <div key={index} className="relative -top-8">
              <Link href={item.href} className="bg-black text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all hover:bg-gray-800">
                <Icon size={28} />
              </Link>
            </div>
          );
        }

        return (
          <Link key={index} href={item.href} className={`flex flex-col items-center p-2 transition-all active:scale-90 ${isActive ? 'text-black' : 'text-gray-300 hover:text-gray-500'}`}>
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
          </Link>
        );
      })}
    </div>
  );
}