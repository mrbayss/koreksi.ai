// src/app/page.tsx
"use client"; // Tambahkan ini di atas agar bisa menggunakan hook dan event handler
import { motion } from "framer-motion";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <motion.h1
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-5xl md:text-7xl font-extrabold text-gray-800"
      >
        Koreksi Jawaban <span className="text-indigo-600">Lebih Cepat</span>.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mt-4 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto"
      >
        Ucapkan selamat tinggal pada tumpukan kertas. Biarkan AI membantu Anda fokus pada hal yang paling penting: mengajar.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mt-12"
      >
        <Link href="/exams/new" className="px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-700 transition-colors duration-300">
          Mulai Sekarang
        </Link>
      </motion.div>
    </div>
  );
}