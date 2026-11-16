# Buổi 6 - Docker, Testing, CI
## Môi trường
- OS: Microsoft Windows 11 Home Single Language (Build 26300, 64-bit)
- Docker version: Docker version 29.9.2
- Python / Node version: Python 3.12.4 / Node.js v26.13.0
## Kết quả local
- pytest backend/tests -q: 2 passed in 4.52s
- npm test: ✔ Tập kiểm thử hàm api() trong src/api.js (10.3327ms)
- npm run build: 
vite v7.1.7 building for production...
✓ 32 modules transformed.
dist/index.html                   0.42 kB │ gzip:  0.32 kB
dist/assets/index-CNgOo9CK.css    3.12 kB │ gzip:  1.24 kB
dist/assets/index-DeD3hrba.js   154.28 kB │ gzip: 49.91 kB
✓ built in 910ms
- docker compose up --build: 
✔ Image coursehub-demo-frontend      Built                                              14.9s
 ✔ Image coursehub-demo-backend       Built                                              14.5s
## Một luồng tích hợp đã kiểm tra
- Request: POST http://localhost:8081/api/enrollments | Body: {student_id: "22000004", class_section_id: "WEB-01"}
- HTTP status: 201 Created
- SQL xác nhận: Trả về 1 dòng bản ghi trùng khớp trong CSDL
## Debug / AI
- Lỗi gặp phải: Xung đột cổng 8080 khi khởi chạy docker compose up --build
- Bằng chứng đã xem: Terminal báo lỗi port is already allocated
- Nếu dùng AI: gợi ý nào đã dùng và đã xác minh thế nào?
-> AI gợi ý sửa cấu hình mapping cổng cho dịch vụ Frontend trong file docker-compose.yml từ 8080 sang 8081. Đã xác minh bằng cách lưu file docker-compose.yml, khởi chạy lại bằng docker compose up -d và đã thành công 
## Pull Request / CI
- PR: #18 (Feature/week06-docker-ci -> main)
- Reviewer: 24001725-uyen
- CI run: pass

## Bài 2 (Bài tập tự thực hành)
- Cố tình đổi từ VITE_API_BASE_URL: /api thành VITE_API_BASE_URL: /api_typo
- Mở cổng http://localhost:8081/ và nhận được kết quả: HTTP 200: phản hồi không phải JSON 
- Sửa lại đúng về /api
- Kiểm tra sau sửa thành công 