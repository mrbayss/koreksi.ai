package main

import (
	"context"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	vision "cloud.google.com/go/vision/apiv1"
	"github.com/adrg/strutil"
	"github.com/adrg/strutil/metrics"
)

// Struct untuk menampung hasil parsing per baris
type ParsedAnswer struct {
	QuestionNumber int
	Answer         string
}

// parseLines adalah fungsi untuk memecah teks dari AI menjadi baris-baris jawaban
func parseLines(rawText string) []ParsedAnswer {
	var answers []ParsedAnswer
	re := regexp.MustCompile(`^\s*(\d+)\s*[.]?\s*(.*)`)

	lines := strings.Split(rawText, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		matches := re.FindStringSubmatch(line)
		if len(matches) == 3 {
			qNum, err := strconv.Atoi(matches[1])
			if err != nil {
				continue
			}
			answer := strings.TrimSpace(matches[2])
			answers = append(answers, ParsedAnswer{
				QuestionNumber: qNum,
				Answer:         answer,
			})
		}
	}
	return answers
}

// detectTextFromImage berkomunikasi dengan Google Vision API
func detectTextFromImage(ctx context.Context, reader io.Reader) (string, error) {
	client, err := vision.NewImageAnnotatorClient(ctx)
	if err != nil {
		return "", fmt.Errorf("gagal membuat client Vision API: %w", err)
	}
	defer client.Close()

	image, err := vision.NewImageFromReader(reader)
	if err != nil {
		return "", fmt.Errorf("gagal membaca data gambar: %w", err)
	}

	annotation, err := client.DetectDocumentText(ctx, image, nil)
	if err != nil {
		return "", fmt.Errorf("gagal mendeteksi teks: %w", err)
	}

	if annotation == nil {
		return "", nil // Tidak ada teks yang terdeteksi
	}

	return annotation.Text, nil
}

// compareAnswers membandingkan dua string dan mengembalikan status benar/salah beserta skornya
func compareAnswers(keyAnswer string, studentAnswer string) (bool, float64) {
	jw := metrics.NewJaroWinkler()
	jw.CaseSensitive = false // Tidak peduli huruf besar/kecil

	// Hitung skor kemiripan (antara 0.0 dan 1.0)
	similarity := strutil.Similarity(keyAnswer, studentAnswer, jw)

	// Tentukan ambang batas, misalnya 85% kemiripan
	isCorrect := similarity > 0.85

	return isCorrect, similarity
}
