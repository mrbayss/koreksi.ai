package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// db akan menjadi variabel global yang bisa diakses oleh handlers
var db *sql.DB

func main() {
	var err error
	// Ganti dengan string koneksi database Anda yang sebenarnya
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// Pesan ini akan muncul di log jika Anda lupa mengatur variabel di Render
		log.Fatal("DATABASE_URL environment variable tidak diatur")
	}

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Gagal membuka koneksi database: %v", err)
	}
	defer db.Close()

	// Cek koneksi ke database
	err = db.Ping()
	if err != nil {
		log.Fatalf("Gagal ping ke database: %v", err)
	}
	fmt.Println("Sukses terhubung ke database!")

	router := gin.Default()

	// Konfigurasi CORS (Cross-Origin Resource Sharing)
	config := cors.DefaultConfig()
	// Ganti dengan URL frontend Anda (termasuk dari tunnel jika perlu)
	config.AllowOrigins = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	router.Use(cors.New(config))

	// --- Rute API ---
	router.POST("/exams", handleCreateExam)

	// Alur Kunci Jawaban
	router.POST("/exams/:exam_id/upload-key", handleUploadKey)
	router.PUT("/exams/:exam_id/verify-keys", handleVerifyKeys)
	router.GET("/exams/:exam_id/verified-keys", handleGetVerifiedKeys)

	// Alur Koreksi Jawaban Siswa
	router.POST("/exams/:exam_id/check-answers", handleCheckStudentAnswers)

	fmt.Println("Server berjalan di http://0.0.0.0:8080")
	if err := router.Run("0.0.0.0:8080"); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
