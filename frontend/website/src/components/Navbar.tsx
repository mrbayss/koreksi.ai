// src/components/Navbar.tsx
import Link from 'next/link';

export const Navbar = () => {
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-indigo-600">
              KoreksiAI
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};