// src/app/exams/new/page.tsx
"use client";

import { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function NewExamPage() {
    const [title, setTitle] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter(); // Inisialisasi router

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');

        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}:8080/exams`, { title });

            // Alih-alih hanya menampilkan pesan, kita arahkan pengguna
            const newExamId = response.data.exam_id;
            router.push(`/exams/${newExamId}`); // Redirect ke halaman ujian baru!

        } catch (error) {
            setMessage('Gagal membuat ujian. Silakan coba lagi.');
            console.error(error);
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-4xl font-bold text-gray-800 mb-8">Buat Ujian Baru</h1>
                <form onSubmit={handleSubmit} className="max-w-lg bg-white p-8 rounded-lg shadow-md">
                    <div className="mb-6">
                        <label htmlFor="title" className="block text-gray-700 text-sm font-bold mb-2">
                            Judul Ujian
                        </label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Contoh: Ulangan Harian Sejarah Bab 1"
                            required
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline disabled:bg-indigo-300"
                        >
                            {isLoading ? 'Membuat...' : 'Buat Ujian'}
                        </button>
                    </div>
                    {message && <p className="mt-6 text-center text-gray-600">{message}</p>}
                </form>
            </motion.div>
        </div>
    );
}