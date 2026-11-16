import os

# Tự động gán giá trị giả lập nếu môi trường (CI/local) chưa khai báo
DB_DEFAULTS = {
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_NAME": "test_db",
    "DB_USER": "test_user",
    "DB_PASSWORD": "test_password",
}

for key, value in DB_DEFAULTS.items():
    os.environ.setdefault(key, value)