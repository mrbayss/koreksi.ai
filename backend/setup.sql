-- Menghapus tabel lama jika ada, untuk setup yang bersih
DROP TABLE IF EXISTS student_answers;
DROP TABLE IF EXISTS answer_keys;
DROP TABLE IF EXISTS exams;

-- Tabel untuk mendefinisikan sebuah ujian
CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel untuk menyimpan KUNCI JAWABAN per nomor soal
CREATE TABLE answer_keys (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    raw_text TEXT,                          -- Teks mentah hasil dari Google Vision AI
    corrected_text TEXT,                    -- Teks yang sudah dikoreksi/diverifikasi oleh guru
    is_verified BOOLEAN DEFAULT false,      -- Status apakah sudah diverifikasi guru atau belum
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Membuat kombinasi exam_id dan question_number unik untuk mencegah duplikasi
    UNIQUE(exam_id, question_number)
);

-- Tabel untuk menyimpan HASIL JAWABAN SISWA per nomor soal
CREATE TABLE student_answers (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    student_text TEXT NOT NULL,             -- Teks jawaban siswa hasil dari AI
    is_correct BOOLEAN NOT NULL,
    score REAL NOT NULL,                    -- Skor kemiripan (0.0 - 1.0)
    checked_at TIMESTAMPTZ DEFAULT now()
);