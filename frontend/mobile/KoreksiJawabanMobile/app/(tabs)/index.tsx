// Lokasi file: app/(tabs)/index.tsx

import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// --- GANTI DENGAN ALAMAT IP LOKAL KOMPUTER ANDA ---
const API_BASE_URL = 'http://192.168.1.6:8080'; // Contoh, sesuaikan dengan IP Anda
// ----------------------------------------------------


interface UnverifiedKey { key_id: number; question_number: number; raw_text: string; }
interface VerifiedKeyPayload { key_id: number; question_number: number; corrected_text: string; }
interface VerifiedKeyDisplay { question_number: number; corrected_text: string; }
interface CorrectionDetail { question_number: number; student_answer: string; is_correct: boolean; score: number; Status: string; }
interface FinalResult { summary: { total_correct: number; total_questions: number; summary_text: string; }; details: CorrectionDetail[]; }

// Define VerifiedKeyDisplay type based on usage in the code
interface VerifiedKeyDisplay {
  question_number: number;
  corrected_text: string;
}

export default function HomeScreen() {
  // State untuk alur wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [examId, setExamId] = useState<number | null>(null);
  const [examTitle, setExamTitle] = useState('');
  
  // State untuk verifikasi kunci jawaban
  const [unverifiedKeys, setUnverifiedKeys] = useState<UnverifiedKey[]>([]);
  const [verifiedKeys, setVerifiedKeys] = useState<VerifiedKeyDisplay[]>([]);
  
  // State untuk izin galeri
  const [mediaLibraryPermission, requestMediaLibraryPermission] = ImagePicker.useMediaLibraryPermissions();

  // State untuk hasil & loading
  const [correctionResult, setCorrectionResult] = useState<FinalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fungsi ini akan berjalan setiap kali `examId` berubah (misalnya setelah dibuat)
    if (!examId) {
        setVerifiedKeys([]); // Kosongkan jika tidak ada examId
        return;
    };

    const fetchVerifiedKeys = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/exams/${examId}/verified-keys`);
        if (response.data && response.data.length > 0) {
          setVerifiedKeys(response.data);
          setCurrentStep(4); // Langsung ke langkah 4 jika kunci sudah ada
        }
      } catch (error) {
        console.error("Gagal mengambil kunci jawaban tersimpan:", error);
      }
    };
    fetchVerifiedKeys();
  }, [examId]);

  // --- LANGKAH 1: Membuat Ujian ---
 const handleCreateExam = async () => {
    if (examTitle.trim() === '') return Alert.alert('Error', 'Judul ujian tidak boleh kosong.');
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/exams`, { title: examTitle });
      const newExamId = response.data.exam_id;
      setExamId(newExamId); // Ini akan memicu useEffect di atas
      Alert.alert('Sukses', `Ujian "${examTitle}" dibuat. Lanjutkan ke Langkah 2.`);
      setCurrentStep(2); 
    } catch (error) { Alert.alert('Error', 'Gagal membuat ujian.'); console.error(error); } 
    finally { setIsLoading(false); }
  };

  // --- Fungsi Terpusat untuk Memproses Gambar ---
  const processImage = async (imageUri: string, mode: 'key' | 'student') => {
    if (!examId) return;
    setIsLoading(true);
    setCorrectionResult(null); // Selalu reset hasil lama
    try {
      const formData = new FormData();
      formData.append('image', { uri: imageUri, name: `upload.jpg`, type: 'image/jpeg' } as any);

      let endpoint = '';
      if (mode === 'key') {
        endpoint = `${API_BASE_URL}/exams/${examId}/upload-key`;
      } else {
        endpoint = `${API_BASE_URL}/exams/${examId}/check-answers`;
      }

      const response = await axios.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      if (mode === 'key') {
        setUnverifiedKeys(response.data);
        setCurrentStep(3); // Maju ke langkah 3 (verifikasi)
        Alert.alert('Sukses', 'Kunci jawaban berhasil dipindai. Lanjutkan ke Langkah 3 untuk verifikasi.');
      } else {
        setCorrectionResult(response.data);
        Alert.alert('Sukses', 'Jawaban siswa berhasil diperiksa!');
      }

    } catch (error) {
      Alert.alert('Error', 'Proses gambar gagal. Pastikan backend berjalan dan koneksi stabil.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LANGKAH 2 & 4: Logika Memilih Gambar ---
  const handlePickImage = async (mode: 'key' | 'student') => {
    if (!mediaLibraryPermission?.granted) {
      const { status } = await requestMediaLibraryPermission();
      if (status !== 'granted') {
        Alert.alert('Izin Dibutuhkan', 'Izin untuk mengakses galeri foto dibutuhkan.');
        return;
      }
    }
    let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
    });

    if (!result.canceled) {
      processImage(result.assets[0].uri, mode);
    }
  };

  // --- LANGKAH 3: Verifikasi Kunci Jawaban ---
  const handleKeyTextChange = (key_id: number, newText: string) => setUnverifiedKeys(keys => keys.map(k => k.key_id === key_id ? { ...k, raw_text: newText } : k));
  const handleDeleteKey = (key_id: number) => setUnverifiedKeys(keys => keys.filter(k => k.key_id !== key_id));
  const handleVerifyKeys = async () => {
    setIsLoading(true);
    const payload = unverifiedKeys.map(k => ({ key_id: k.key_id, question_number: k.question_number, corrected_text: k.raw_text }));
    try {
      await axios.put(`${API_BASE_URL}/exams/${examId}/verify-keys`, payload);
      setUnverifiedKeys([]);
      
      // Ambil kembali data yang baru diverifikasi untuk ditampilkan
      const response = await axios.get(`${API_BASE_URL}/exams/${examId}/verified-keys`);
      setVerifiedKeys(response.data);
      
      Alert.alert('Sukses', 'Kunci jawaban berhasil diverifikasi!');
      setCurrentStep(4); // Maju ke langkah 4
    } catch (error) { Alert.alert('Error', 'Gagal memverifikasi kunci.'); console.error(error); }
    finally { setIsLoading(false); }
  };

  // --- Tampilan Aplikasi ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>KoreksiAI Mobile</Text>
      <StatusBar style="auto" />

      {/* --- KARTU LANGKAH 1 --- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Langkah 1: Buat Ujian</Text>
        <TextInput style={styles.input} placeholder="Contoh: Ulangan Harian Bab 1" value={examTitle} onChangeText={setExamTitle} editable={currentStep === 1}/>
        <TouchableOpacity style={[styles.button, currentStep !== 1 && styles.disabledButton]} onPress={handleCreateExam} disabled={isLoading || currentStep !== 1}>
          <Text style={styles.buttonText}>{isLoading && currentStep === 1 ? 'Membuat...' : 'Buat Ujian Baru'}</Text>
        </TouchableOpacity>
        {examId && <Text style={styles.infoText}>Ujian Aktif: &quot;{examTitle}&quot; (ID: {examId})</Text>}
      </View>

      {/* --- KARTU LANGKAH 2 --- */}
      <View style={[styles.card, currentStep < 2 && styles.disabledCard]}>
        <Text style={styles.cardTitle}>Langkah 2: Input Kunci Jawaban</Text>
        
        {/* --- TAMPILAN BARU: Menampilkan Kunci Jawaban yang Sudah Ada --- */}
        {verifiedKeys.length > 0 && (
            <View style={styles.verifiedKeyContainer}>
               <Text style={styles.verifiedKeyTitle}>Kunci Jawaban Tersimpan:</Text>
               {verifiedKeys.map(key => (
                   <Text key={key.question_number} style={styles.verifiedKeyText}>
                       {key.question_number}. {key.corrected_text}
                   </Text>
               ))}
            </View>
        )}

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => handlePickImage('key')} disabled={isLoading || currentStep !== 2}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            {verifiedKeys.length > 0 ? '🖼️ Ganti Kunci Jawaban' : '🖼️ Pilih Gambar Kunci Jawaban'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* --- KARTU LANGKAH 3 (Hanya muncul saat verifikasi) --- */}
      {unverifiedKeys.length > 0 && currentStep === 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Langkah 3: Verifikasi Kunci Jawaban</Text>
          <Text style={styles.subTitle}>Periksa hasil scan. Edit atau hapus jika perlu.</Text>
          {unverifiedKeys.map(key => (
            <View key={key.key_id} style={styles.verifyRow}>
              <TextInput value={String(key.question_number)} keyboardType="numeric" style={styles.verifyInputNumber} />
              <TextInput value={key.raw_text} onChangeText={(text) => handleKeyTextChange(key.key_id, text)} style={styles.verifyInputText}/>
              <TouchableOpacity onPress={() => handleDeleteKey(key.key_id)}><Text style={{color: 'red'}}>Hapus</Text></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.button, {backgroundColor: '#28a745', marginTop: 15}]} onPress={handleVerifyKeys} disabled={isLoading}>
            <Text style={styles.buttonText}>{isLoading ? 'Menyimpan...' : 'Simpan Kunci Jawaban'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- KARTU LANGKAH 4 --- */}
      <View style={[styles.card, currentStep < 4 && styles.disabledCard]}>
        <Text style={styles.cardTitle}>Langkah 4: Periksa Jawaban Siswa</Text>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => handlePickImage('student')} disabled={isLoading || currentStep !== 4}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>🖼️ Pilih Jawaban Siswa</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator size="large" color="#457b9d" style={{marginVertical: 20}}/>}
      
      {/* --- BAGIAN HASIL KOREKSI (DENGAN PERUBAHAN) --- */}
      {correctionResult && (
        <View style={[styles.card, styles.resultCard]}>
          <Text style={styles.cardTitle}>Hasil Koreksi</Text>
          
          {/* Ringkasan Skor Total */}
          <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{correctionResult.summary.summary_text}</Text>
          </View>
          
          {/* --- BAGIAN BARU: Rincian Nomor Benar & Salah --- */}
          <View style={styles.detailsSummaryBox}>
            {(() => {
              const correctNumbers = correctionResult.details
                .filter(item => item.is_correct)
                .map(item => item.question_number)
                .join(', ');

              const incorrectNumbers = correctionResult.details
                .filter(item => !item.is_correct)
                .map(item => item.question_number)
                .join(', ');

              return (
                <>
                  {correctNumbers.length > 0 && (
                    <Text style={styles.detailText}>
                      <Text style={styles.correctLabel}>✅ Benar: </Text>
                      Nomor {correctNumbers}
                    </Text>
                  )}
                  {incorrectNumbers.length > 0 && (
                    <Text style={styles.detailText}>
                      <Text style={styles.incorrectLabel}>❌ Salah: </Text>
                      Nomor {incorrectNumbers}
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
          {/* -------------------------------------------------- */}
          
          <Text style={styles.subTitle}>Rincian per Soal:</Text>
          {correctionResult.details.map((item) => (
            <View key={item.question_number} style={styles.resultRow}>
              <Text style={styles.resultText}>No. {item.question_number}: {item.student_answer}</Text>
              <Text style={[styles.statusText, { color: item.is_correct ? '#28a745' : '#dc3545' }]}>{item.Status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// --- StyleSheet untuk styling ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 50 },
  header: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1d3557' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 4 },
  disabledCard: { backgroundColor: '#e9ecef', opacity: 0.6 },
  cardTitle: { fontSize: 20, fontWeight: '600', marginBottom: 15, color: '#457b9d' },
  subTitle: { fontSize: 14, color: '#6c757d', marginBottom: 15, marginTop: -10 },
  input: { borderWidth: 1, borderColor: '#ddd', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#457b9d', padding: 15, borderRadius: 8, alignItems: 'center' },
  disabledButton: { backgroundColor: '#a9b9c5'},
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoText: { marginTop: 15, textAlign: 'center', color: '#555', fontSize: 14, fontStyle: 'italic' },
  verifyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  verifyInputNumber: { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 5, width: 50, textAlign: 'center', marginRight: 10 },
  verifyInputText: { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 5, flex: 1 },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#457b9d' },
  secondaryButtonText: { color: '#457b9d' },
  resultCard: { backgroundColor: '#f8f9fa' },
  summaryBox: { backgroundColor: '#e9ecef', padding: 15, borderRadius: 8, marginBottom: 15 },
  summaryText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#1d3557' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  resultText: { fontSize: 16, color: '#495057' },
  statusText: { fontSize: 16, fontWeight: 'bold' },
  verifiedKeyContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#eafaf1',
    borderColor: '#b8e9c7',
    borderWidth: 1,
    borderRadius: 8,
  },
  verifiedKeyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a7431',
    marginBottom: 5,
  },
  verifiedKeyText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 5,
  },
   detailsSummaryBox: {
    padding: 10,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  detailText: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 5,
  },
  correctLabel: {
    fontWeight: 'bold',
    color: '#28a745',
  },
  incorrectLabel: {
    fontWeight: 'bold',
    color: '#dc3545',
  },
});