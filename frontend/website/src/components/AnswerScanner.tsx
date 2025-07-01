// Lokasi File: src/components/AnswerScanner.tsx

"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';

interface AnswerScannerProps {
  onCapture: (imageSrc: string) => void;
}

export const AnswerScanner = ({ onCapture }: AnswerScannerProps) => {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot({ width: 1280, height: 720 });
      if (imageSrc) {
        onCapture(imageSrc);
      }
    }
  }, [webcamRef, onCapture]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prevState => (prevState === "user" ? "environment" : "user"));
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      <div className="w-full rounded-lg overflow-hidden border-4 border-gray-300 dark:border-gray-600 shadow-lg relative">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.9}
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: facingMode
          }}
          className="w-full h-full"
        />
        {/* Tombol untuk ganti kamera */}
        <button 
          onClick={toggleCamera} 
          className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 text-white rounded-full"
          aria-label="Ganti Kamera"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M15 4h5v5M9 20H4v-5" />
          </svg>
        </button>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={capture}
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-xl"
      >
        Scan Jawaban
      </motion.button>
    </div>
  );
};