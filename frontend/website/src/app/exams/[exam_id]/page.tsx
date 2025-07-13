/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AnswerScanner } from '@/components/AnswerScanner';

// --- Definisi Tipe Data untuk Type-Safety ---
interface UnverifiedKey {
  key_id: number;
  question_number: number;
  raw_text: string;
}

interface VerifiedKeyPayload {
    key_id: number;
    question_number: number;
    corrected_text: string;
}

interface VerifiedKeyDisplay {
  question_number: number;
  corrected_text: string;
}

interface CorrectionDetail {
  question_number: number;
  student_answer: string;
  is_correct: boolean;
  score: number;
  Status: string;
}

interface FinalResult {
  summary: {
    total_correct: number;
    total_questions: number;
    summary_text: string;
  };
  details: CorrectionDetail[];
}


// --- Komponen Utama Halaman Ujian ---
export default function ExamDetailPage() {
  
  const params = useParams();
  const exam_id = params.exam_id as string;

  // --- State Management ---
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [unverifiedKeys, setUnverifiedKeys] = useState<UnverifiedKey[]>([]);
  const [verifiedKeys, setVerifiedKeys] = useState<VerifiedKeyDisplay[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [correctionResult, setCorrectionResult] = useState<FinalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');


  // --- Data Fetching: Mengambil kunci jawaban yang sudah ada saat halaman dimuat ---
  useEffect(() => {
    if (!exam_id) return;

    const fetchVerifiedKeys = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/exams/${exam_id}/verified-keys`);
        if (response.data && response.data.length > 0) {
          setVerifiedKeys(response.data);
        }
      } catch (error) {
        console.error("Gagal mengambil kunci jawaban yang tersimpan:", error);
      }
    };

    fetchVerifiedKeys();
  }, [exam_id]);


  // --- Handlers untuk Alur Kunci Jawaban ---

  const handleKeyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setKeyFile(e.target.files[0]);
      setUnverifiedKeys([]);
      setMessage('');
    }
  };

  const handleUploadKey = async () => {
    if (!keyFile) { 
      setMessage('Pilih file kunci jawaban dulu.'); 
      return; 
    }
    const isConfirmed = window.confirm("Mengunggah kunci jawaban baru akan menghapus dan mengganti kunci jawaban yang sudah ada. Apakah Anda yakin?");
    if (!isConfirmed) {
      return;
    }
    setIsLoading(true); 
    setMessage(''); 
    setUnverifiedKeys([]);
    const formData = new FormData();
    formData.append('image', keyFile);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/exams/${exam_id}/upload-key`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setVerifiedKeys([]); 
      setUnverifiedKeys(response.data);
      setMessage('Gambar berhasil diproses. Silakan mulai proses validasi ulang.');
    } catch (error) { 
      setMessage('Gagal mengunggah kunci jawaban. Pastikan backend berjalan.'); 
      console.error(error); 
    } finally { 
      setIsLoading(false); 
    }
  };
  
  const handleKeyNumberChange = (key_id: number, newNumberStr: string) => {
    const newNumber = parseInt(newNumberStr, 10);
    setUnverifiedKeys(currentKeys =>
      currentKeys.map(key =>
        key.key_id === key_id ? { ...key, question_number: isNaN(newNumber) ? 0 : newNumber } : key
      )
    );
  };
  
  const handleKeyTextChange = (key_id: number, newText: string) => {
    setUnverifiedKeys(currentKeys =>
      currentKeys.map(key =>
        key.key_id === key_id ? { ...key, raw_text: newText } : key
      )
    );
  };
  
  const handleDeleteKey = (key_id_to_delete: number) => {
    setUnverifiedKeys(currentKeys =>
      currentKeys.filter(key => key.key_id !== key_id_to_delete)
    );
  };

  const handleVerifyKeys = async () => {
    setIsLoading(true);
    setMessage('');
    const payload: VerifiedKeyPayload[] = unverifiedKeys.map(key => ({
        key_id: key.key_id,
        question_number: key.question_number,
        corrected_text: key.raw_text,
    }));
    try {
        await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/exams/${exam_id}/verify-keys`, payload);
        setMessage('Kunci jawaban berhasil diverifikasi!');
        setUnverifiedKeys([]);
        
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/exams/${exam_id}/verified-keys`);
        setVerifiedKeys(response.data);
    } catch (error) { 
        setMessage('Gagal memverifikasi kunci. Coba lagi.'); 
        console.error(error); 
    } finally { 
        setIsLoading(false); 
    }
  };

  // --- Handlers untuk Alur Jawaban Siswa dengan Scanner ---

  const handleCapture = (imageSrc: string) => {
    setCapturedImage(imageSrc);
    setCorrectionResult(null);
    setMessage('');
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };
  
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)![1], bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], {type:mime});
  }

  const handleCheckAnswer = async () => {
    if (!capturedImage) { 
      setMessage('Scan gambar jawaban siswa dulu.'); 
      return; 
    }
    setIsLoading(true); 
    setMessage(''); 
    setCorrectionResult(null);
    const imageBlob = dataURLtoBlob(capturedImage);
    const formData = new FormData();
    formData.append('image', imageBlob, `jawaban_siswa_${exam_id}.jpg`);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/exams/${exam_id}/check-answers`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setCorrectionResult(response.data);
      setMessage('Jawaban siswa berhasil diperiksa!');
    } catch (error) { 
      setMessage('Gagal memeriksa jawaban. Pastikan kunci jawaban sudah diverifikasi.'); 
      console.error(error); 
    } finally { 
      setIsLoading(false); 
    }
  };


  // --- Tampilan Komponen (JSX) ---
  return (
    <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold text-gray-800">Detail Ujian</h1>
                <p className="text-gray-500 mt-2">Ujian ID: {exam_id}</p>
                
                {/* Bagian 1: Kunci Jawaban */}
                <div className="mt-8 p-6 bg-white rounded-lg shadow-lg">
                    <h2 className="text-2xl font-semibold text-gray-700">Langkah 1: Kunci Jawaban</h2>

                    {unverifiedKeys.length === 0 && verifiedKeys.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="mt-6 mb-8 p-4 border border-green-200 bg-green-50 rounded-lg"
                        >
                           <h3 className="font-semibold text-green-800">Kunci Jawaban Tersimpan:</h3>
                           <ul className="mt-2 list-decimal list-inside text-gray-700 space-y-1">
                                {verifiedKeys.map(key => (
                                    <li key={key.question_number}>
                                        <span className="font-medium">{key.corrected_text}</span>
                                    </li>
                                ))}
                           </ul>
                        </motion.div>
                    )}

                    <p className="text-sm text-gray-600 mt-2 mb-6">
                      Unggah gambar kunci jawaban. 
                      <strong className="text-red-600"> Mengunggah file baru akan menggantikan yang sudah ada.</strong>
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                        <input
                            type="file"
                            onChange={handleKeyFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            accept="image/*"
                        />
                        <button
                            onClick={handleUploadKey}
                            disabled={isLoading || !keyFile}
                            className="mt-4 sm:mt-0 w-full sm:w-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline disabled:bg-indigo-300 transition-colors"
                        >
                            {isLoading ? 'Memproses...' : 'Proses Gambar'}
                        </button>
                    </div>
                </div>

                {/* Bagian Verifikasi Kunci Jawaban */}
                <AnimatePresence>
                {unverifiedKeys.length > 0 && (
                <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 p-6 bg-white rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Verifikasi Kunci Jawaban</h3>
                    <p className="text-sm text-gray-600 mb-6">Periksa hasil AI. Edit nomor/jawaban, atau hapus baris yang tidak perlu.</p>
                    <div className="space-y-4">
                    {unverifiedKeys.sort((a,b) => a.question_number - b.question_number).map((key) => (
                        <motion.div key={key.key_id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center space-x-2 md:space-x-4">
                        <input type="number" value={key.question_number} onChange={(e) => handleKeyNumberChange(key.key_id, e.target.value)} className="shadow-sm bg-white appearance-none border rounded w-16 py-2 px-2 text-gray-700 text-center leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <input type="text" value={key.raw_text} onChange={(e) => handleKeyTextChange(key.key_id, e.target.value)} className="shadow-sm bg-white appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <button onClick={() => handleDeleteKey(key.key_id)} className="p-2 shrink-0 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors" aria-label="Hapus baris">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                        </button>
                        </motion.div>
                    ))}
                    </div>
                    <button onClick={handleVerifyKeys} disabled={isLoading} className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline disabled:bg-green-300 transition-colors">
                        {isLoading ? 'Menyimpan...' : 'Simpan & Verifikasi'}
                    </button>
                </motion.div>
                )}
                </AnimatePresence>

                {/* Bagian 2: Periksa Jawaban Siswa */}
                <div className="mt-10 p-6 bg-white rounded-lg shadow-lg">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Langkah 2: Periksa Jawaban Siswa</h2>
                    <AnimatePresence mode="wait">
                      {!capturedImage ? (
                        <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <p className="text-sm text-gray-600 mb-6">Arahkan kamera ke lembar jawaban siswa dan tekan tombol "Scan Jawaban".</p>
                          <AnswerScanner onCapture={handleCapture} />
                        </motion.div>
                      ) : (
                        <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <h3 className="text-lg font-medium text-gray-800">Pratinjau Gambar:</h3>
                          <img src={capturedImage} alt="Pratinjau Jawaban Siswa" className="mt-4 rounded-lg shadow-md w-full max-w-lg mx-auto" />
                          <div className="mt-6 flex justify-center space-x-4">
                            <button onClick={handleRetake} disabled={isLoading} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg">
                              Ambil Ulang
                            </button>
                            <button onClick={handleCheckAnswer} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
                              {isLoading ? 'Memeriksa...' : 'Gunakan & Periksa'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                </div>

                {/* Bagian Hasil Koreksi */}
                <AnimatePresence>
                {correctionResult && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10 p-6 bg-white rounded-lg shadow-lg">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Hasil Koreksi</h2>
                    <div className="mb-8 text-center bg-indigo-100 p-6 rounded-lg">
                        <p className="text-xl text-indigo-800">Ringkasan</p>
                        <p className="text-4xl font-bold text-indigo-700 mt-2">{correctionResult.summary.summary_text}</p>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jawaban Siswa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skor</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hasil</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {correctionResult.details.map((result) => (
                            <motion.tr key={result.question_number} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: result.question_number * 0.1 }}>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{result.question_number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700">{result.student_answer}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{result.score.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${result.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {result.Status}
                                </span>
                            </td>
                            </motion.tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                </motion.div>
                )}
                </AnimatePresence>
                
                {message && <p className="mt-6 text-center text-gray-600 font-medium">{message}</p>}
            </motion.div>
        </div>
    </div>
  );
}