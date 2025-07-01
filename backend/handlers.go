package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Struct yang digunakan oleh berbagai handler
type ExamRequest struct {
	Title string `json:"title" binding:"required"`
}

type UnverifiedKey struct {
	KeyID          int    `json:"key_id"`
	QuestionNumber int    `json:"question_number"`
	RawText        string `json:"raw_text"`
}

type VerifiedKey struct {
	KeyID          int    `json:"key_id" binding:"required"`
	QuestionNumber int    `json:"question_number"`
	CorrectedText  string `json:"corrected_text"`
}

type VerifiedKeyDisplay struct {
	QuestionNumber int    `json:"question_number"`
	CorrectedText  string `json:"corrected_text"`
}

type CorrectionResult struct {
	QuestionNumber int     `json:"question_number"`
	StudentAnswer  string  `json:"student_answer"`
	IsCorrect      bool    `json:"is_correct"`
	Score          float64 `json:"score"`
	Status         string  `json:"status"`
}

func handleCreateExam(c *gin.Context) {
	var req ExamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field 'title' dibutuhkan"})
		return
	}
	var examID int
	err := db.QueryRow("INSERT INTO exams (title) VALUES ($1) RETURNING id", req.Title).Scan(&examID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat ujian baru"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"exam_id": examID, "title": req.Title})
}

func handleUploadKey(c *gin.Context) {
	examID := c.Param("exam_id")
	fileHeader, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File gambar 'image' tidak ditemukan"})
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuka file"})
		return
	}
	defer file.Close()
	rawText, err := detectTextFromImage(context.Background(), file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses gambar"})
		return
	}
	parsedKeys := parseLines(rawText)
	if len(parsedKeys) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada nomor jawaban yang bisa diparsing"})
		return
	}
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi database"})
		return
	}
	_, err = tx.Exec("DELETE FROM answer_keys WHERE exam_id = $1", examID)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus kunci jawaban lama"})
		return
	}
	var unverifiedKeys []UnverifiedKey
	processedNumbers := make(map[int]bool)
	for _, key := range parsedKeys {
		if _, exists := processedNumbers[key.QuestionNumber]; exists {
			log.Printf("Mengabaikan duplikat nomor soal %d dalam satu upload", key.QuestionNumber)
			continue
		}
		var keyID int
		err := tx.QueryRow("INSERT INTO answer_keys (exam_id, question_number, raw_text) VALUES ($1, $2, $3) RETURNING id",
			examID, key.QuestionNumber, key.Answer).Scan(&keyID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal menyimpan kunci jawaban no %d: %v", key.QuestionNumber, err)})
			return
		}
		processedNumbers[key.QuestionNumber] = true
		unverifiedKeys = append(unverifiedKeys, UnverifiedKey{
			KeyID:          keyID,
			QuestionNumber: key.QuestionNumber,
			RawText:        key.Answer,
		})
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}
	c.JSON(http.StatusCreated, unverifiedKeys)
}

func handleVerifyKeys(c *gin.Context) {
	examID := c.Param("exam_id")
	var reqBody []VerifiedKey
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data verifikasi tidak valid"})
		return
	}
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi database"})
		return
	}
	for _, key := range reqBody {
		_, err := tx.Exec("UPDATE answer_keys SET corrected_text = $1, question_number = $2, is_verified = TRUE WHERE id = $3 AND exam_id = $4",
			key.CorrectedText, key.QuestionNumber, key.KeyID, examID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Gagal memverifikasi kunci jawaban ID %d", key.KeyID)})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit verifikasi"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Semua kunci jawaban berhasil diverifikasi."})
}

func handleGetVerifiedKeys(c *gin.Context) {
	examID := c.Param("exam_id")
	rows, err := db.Query("SELECT question_number, corrected_text FROM answer_keys WHERE exam_id = $1 AND is_verified = TRUE ORDER BY question_number", examID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil kunci jawaban"})
		return
	}
	defer rows.Close()
	var keys []VerifiedKeyDisplay
	for rows.Next() {
		var key VerifiedKeyDisplay
		if err := rows.Scan(&key.QuestionNumber, &key.CorrectedText); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data kunci jawaban"})
			return
		}
		keys = append(keys, key)
	}
	c.JSON(http.StatusOK, keys)
}

func handleCheckStudentAnswers(c *gin.Context) {
	examID := c.Param("exam_id")
	fileHeader, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File gambar jawaban siswa tidak ditemukan"})
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuka file jawaban siswa"})
		return
	}
	defer file.Close()
	studentRawText, err := detectTextFromImage(context.Background(), file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses gambar siswa"})
		return
	}
	studentAnswers := parseLines(studentRawText)
	if len(studentAnswers) == 0 {
		c.JSON(http.StatusOK, gin.H{"summary": "Tidak ada jawaban yang terdeteksi pada lembar siswa.", "details": []CorrectionResult{}})
		return
	}
	rows, err := db.Query("SELECT question_number, corrected_text FROM answer_keys WHERE exam_id = $1 AND is_verified = TRUE", examID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil kunci jawaban dari database"})
		return
	}
	defer rows.Close()
	keyMap := make(map[int]string)
	for rows.Next() {
		var qNum int
		var text string
		if err := rows.Scan(&qNum, &text); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memindai data kunci jawaban"})
			return
		}
		keyMap[qNum] = text
	}
	var finalResults []CorrectionResult
	processedNumbers := make(map[int]bool)
	for _, studentAns := range studentAnswers {
		if _, exists := processedNumbers[studentAns.QuestionNumber]; exists {
			continue
		}
		keyAns, found := keyMap[studentAns.QuestionNumber]
		var result CorrectionResult
		if !found {
			result = CorrectionResult{QuestionNumber: studentAns.QuestionNumber, StudentAnswer: studentAns.Answer, IsCorrect: false, Score: 0, Status: "Kunci Tidak Ada"}
		} else {
			isCorrect, score := compareAnswers(keyAns, studentAns.Answer)
			status := "Salah"
			if isCorrect {
				status = "Benar"
			}
			result = CorrectionResult{QuestionNumber: studentAns.QuestionNumber, StudentAnswer: studentAns.Answer, IsCorrect: isCorrect, Score: score, Status: status}
		}
		finalResults = append(finalResults, result)
		processedNumbers[studentAns.QuestionNumber] = true
	}
	totalCorrect := 0
	for _, result := range finalResults {
		if result.IsCorrect {
			totalCorrect++
		}
	}
	totalQuestions := len(keyMap)
	if totalQuestions == 0 {
		totalQuestions = len(finalResults) // Fallback if no keys found
	}
	summaryText := fmt.Sprintf("Benar: %d dari %d soal", totalCorrect, totalQuestions)
	finalResponse := gin.H{
		"summary": gin.H{"total_correct": totalCorrect, "total_questions": totalQuestions, "summary_text": summaryText},
		"details": finalResults,
	}
	c.JSON(http.StatusOK, finalResponse)
}
