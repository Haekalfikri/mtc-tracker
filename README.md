# MTC Productivity Tracker

MTC Productivity Tracker adalah aplikasi web cerdas berbasis Google Apps Script (GAS) yang dirancang khusus untuk memudahkan *Master Teacher Coach* (MTC) dalam mengisi laporan aktivitas harian (Working Hours & Teaching Hours) secara mulus ke Google Spreadsheet.

Dengan antarmuka (UI) yang modern, mulus, dan sangat responsif di perangkat mobile, aplikasi ini mengubah pengalaman input log manual yang kaku di Spreadsheet menjadi sangat cepat dan efisien.

## 🌟 Fitur Unggulan

- **Dashboard Pintar**: Pantau progres jam kerja harian Anda dengan target yang dihitung secara cerdas dan dinamis mengikuti rentang waktu yang sedang Anda lihat.
- **Sistem Jadwal Rutin**: Bosan mengetik jadwal yang sama setiap minggu? Simpan jadwal berulang Anda dan masukkan ke laporan hanya dengan satu klik!
- **Manajemen *Timeline***: Lacak, Edit, atau Hapus sesi kerja Anda yang telah tersimpan langsung dari antarmuka web tanpa perlu membuka Spreadsheet.
- **Riwayat & Filter Canggih**: Analisis total jam kerja Anda berdasarkan rentang tanggal, bulan, kategori kelas, atau produk.
- **Database Personal Otomatis**: Aplikasi secara otomatis membuat database terpisah (*MTC_Personal_DB*) di Google Drive Anda untuk menyimpan pengaturan konfigurasi tanpa mencemari dokumen Tracker utama.
- **Keamanan PIN**: Menggunakan sistem *Security PIN* sederhana untuk mencegah akses input dari pihak luar.

## 🚀 Cara Instalasi (Deploy)

Aplikasi ini bersifat *serverless* dan sepenuhnya menggunakan ekosistem Google secara gratis.

1. Buka file Google Spreadsheet Tracker Anda. Pastikan akses *Share* di pojok kanan atas diubah menjadi **"Siapa saja yang memiliki link"** dengan peran **"Editor"**.
2. Klik menu **Ekstensi > Apps Script**.
3. Buat 5 file berikut di dalam editor, lalu salin (*copy-paste*) kode dari masing-masing file yang ada di repositori ini:
   - `Code.gs` (Pilih tipe Skrip)
   - `Index.html` (Pilih tipe HTML)
   - `CSS.html` (Pilih tipe HTML)
   - `JS.html` (Pilih tipe HTML)
   - `Sidebar.html` (Pilih tipe HTML)
4. Buka file `Code.gs` dan ubah konfigurasi wajib di baris paling atas:
   - `SECURITY_PIN`: Ganti dengan PIN 4 digit rahasia Anda.
   - `SPREADSHEET_URL`: Masukkan link URL lengkap Spreadsheet Anda.
5. Klik tombol biru **Terapkan (Deploy)** > **Deployment Baru**. 
6. Pilih ikon roda gigi ⚙️ > **Aplikasi Web**. Atur opsi "Siapa yang memiliki akses" menjadi **Siapa saja (Anyone)**.
7. Otorisasi skrip (hanya untuk pertama kali), dan salin URL Web App yang dihasilkan.

*(Catatan: Anda dapat menggunakan layanan pemendek URL seperti Bit.ly agar tautan web mudah dihafal).*

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS (Desain Modern Kustom), Vanilla JS.
- **Backend & API**: Google Apps Script.
- **Database**: Google Spreadsheet.
- **Ikonografi**: SVG Icons murni.

## 👨‍💻 Pengembang

**Haekal Fikri**
*MTC EAC Polman - Andi Depu*

- 📱 WhatsApp: [087754123661](https://wa.me/6287754123661)
- 📸 Instagram: [@Heykalfikri](https://instagram.com/Heykalfikri)
- ✉️ Email: haekal.fikri.h@ruangguru.id

---
*Dibuat untuk mempermudah alur kerja dan meningkatkan produktivitas.*
