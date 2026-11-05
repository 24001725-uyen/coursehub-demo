from __future__ import annotations
import logging
from fastapi import FastAPI, HTTPException, Query, Response, status
from sqlalchemy import text

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .database import engine
from .schemas import EnrollmentCreate

from .schemas import UpdateCapacityRequest
from typing import Optional

logger = logging.getLogger(__name__)

app = FastAPI(
title="CourseHub API",
version="0.4.0",
description="API thuc hanh Buoi 4 - transaction, locking va hieu nang",
)

@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "CourseHub API dang hoat dong"}

@app.get("/health")
def health_check() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Khong ket noi duoc co so du lieu")
        raise HTTPException(
            status_0code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Khong ket noi duoc co so du lieu",
        ) from exc
    return {"status": "ok", "database": "connected"}

@app.get("/courses")
def list_courses(
    q: str | None = Query(default=None, min_length=1),
) -> list[dict[str, object]]:
    sql = """
        SELECT code, name, credits
        FROM courses
    """
    parameters: dict[str, object] = {}
    if q is not None:
        keyword = q.strip().lower()
        if not keyword:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tu khoa tim kiem khong duoc rong",
            )
        sql += """
            WHERE LOWER(code) LIKE :keyword
                OR LOWER(name) LIKE :keyword
        """
        parameters["keyword"] = f"%{keyword}%"
    sql += " ORDER BY code"
    with engine.connect() as connection:
        rows = connection.execute(text(sql), parameters).mappings().all()
    return [dict(row) for row in rows]

@app.get("/courses/{course_code}")
def get_course(course_code: str) -> dict[str, object]:
    sql = """
    SELECT code, name, credits
    FROM courses
    WHERE code = :course_code
    """
    with engine.connect() as connection:
        row = connection.execute(
            text(sql),
            {"course_code": course_code.upper()},
        ).mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Khong tim thay hoc phan",
        )
    return dict(row)

@app.get("/sections")
def list_sections(
    available_only: bool = False,
    ) -> list[dict[str, object]]:
    sql = """
    SELECT class_id, course_code, capacity, enrolled, remaining
    FROM v_section_summary
    """
    if available_only:
        sql += " WHERE remaining > 0"
    sql += " ORDER BY class_id"
    with engine.connect() as connection:
        rows = connection.execute(text(sql)).mappings().all()
    return [dict(row) for row in rows]

@app.get("/students/{student_id}/enrollments")
def list_student_enrollments(student_id: str) -> list[dict[str, object]]:
    student_sql = "SELECT id FROM students WHERE id = :student_id"
    enrollment_sql = """
    SELECT e.student_id,
        s.name AS student_name,
        cs.id AS class_section_id,
        c.code AS course_code,
        c.name AS course_name,
        e.registered_at
    FROM enrollments AS e
    JOIN students AS s ON s.id = e.student_id
    JOIN class_sections AS cs ON cs.id = e.class_section_id
    JOIN courses AS c ON c.code = cs.course_code
    WHERE e.student_id = :student_id
    ORDER BY cs.id
    """
    with engine.connect() as connection:
        student = connection.execute(
            text(student_sql),
            {"student_id": student_id},
        ).first()

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay sinh vien",
            )
        rows = connection.execute(
            text(enrollment_sql),
            {"student_id": student_id},
        ).mappings().all()
    return [dict(row) for row in rows]

@app.post(
    "/enrollments",
    status_code=status.HTTP_201_CREATED,
)

def create_enrollment(payload: EnrollmentCreate) -> dict[str, str]:
    student_sql = "SELECT id FROM students WHERE id = :student_id"
    lock_section_sql = """
    SELECT id, capacity
    FROM class_sections
    WHERE id = :class_section_id
    FOR UPDATE
    """
    duplicate_sql = """
    SELECT 1
    FROM enrollments
    WHERE student_id = :student_id
    AND class_section_id = :class_section_id
    """
    count_sql = """
    SELECT COUNT(*)
    FROM enrollments
    WHERE class_section_id = :class_section_id
    """
    insert_sql = """
    INSERT INTO enrollments (student_id, class_section_id)
    VALUES (:student_id, :class_section_id)
    """
    event_sql = """
    INSERT INTO enrollment_events
    (student_id, class_section_id, event_type, source, dataset)
    VALUES
    (:student_id, :class_section_id, 'CREATED', 'api', 'demo')
    """
    parameters = {
        "student_id": payload.student_id,
        "class_section_id": payload.class_section_id,
    }

    try:
        with engine.begin() as connection:
            student = connection.execute(
                text(student_sql),
                {"student_id": payload.student_id},
            ).first()
            if student is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Khong tim thay sinh vien",
                )
            section = connection.execute(
                text(lock_section_sql),
                {"class_section_id": payload.class_section_id},
            ).mappings().first()
            if section is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Khong tim thay lop hoc phan",
                )
            duplicated = connection.execute(
                text(duplicate_sql), parameters
            ).first()
            if duplicated is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Sinh vien da dang ky lop nay",
                )
            enrolled = connection.execute(
                text(count_sql),
                {"class_section_id": payload.class_section_id},
            ).scalar_one()
            if int(enrolled) >= int(section["capacity"]):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Lop hoc phan da het cho",
                )
            connection.execute(text(insert_sql), parameters)
            connection.execute(text(event_sql), parameters)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Dang ky xung dot voi du lieu hien tai",
        ) from exc
    return {
        "message": "Dang ky thanh cong",
        "student_id": payload.student_id,
        "class_section_id": payload.class_section_id,
    }

@app.delete(
    "/enrollments/{student_id}/{class_section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_enrollment(student_id: str, class_section_id: str) -> Response:
    lock_section_sql = """
        SELECT id
        FROM class_sections
        WHERE id = :class_section_id
        FOR UPDATE
    """
    delete_sql = """
        DELETE FROM enrollments
        WHERE student_id = :student_id
            AND class_section_id = :class_section_id
        RETURNING student_id
    """
    event_sql = """
        INSERT INTO enrollment_events
        (student_id, class_section_id, event_type, source, dataset)
        VALUES
        (:student_id, :class_section_id, 'CANCELLED', 'api', 'demo')
    """
    parameters = {
        "student_id": student_id,
        "class_section_id": class_section_id,
    }
    
    with engine.begin() as connection:
        section = connection.execute(
            text(lock_section_sql),
            {"class_section_id": class_section_id},
        ).first()
        
        if section is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay lop hoc phan",
            )
            
        deleted = connection.execute(
            text(delete_sql), parameters
        ).first()
        
        if deleted is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay dang ky can huy",
            )
            
        connection.execute(text(event_sql), parameters)
        
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# BÀI TẬP TỰ THỰC HÀNH

# Bài 1: GET /lecturers - Danh sách giảng viên
@app.get("/lecturers")
def list_lecturers() -> list[dict[str, object]]:
    sql = "SELECT id, name FROM lecturers ORDER BY id ASC"
    with engine.connect() as connection:
        rows = connection.execute(text(sql)).mappings().all()
    return [dict(row) for row in rows]


# Bài 2: GET /sections/{section_id} - Chi tiết lớp học phần
@app.get("/sections/{section_id}")
def get_section_detail(section_id: str) -> dict[str, object]:
    # Đúng tên cột: cs.semester_code, c.code, v.class_id
    sql = """
        SELECT 
            cs.id AS section_id,
            c.code AS course_code,
            c.name AS course_name,
            cs.semester_code AS semester,
            COALESCE(l.name, 'Chua phan cong') AS lecturer_name,
            cs.capacity,
            COALESCE(v.enrolled, 0) AS enrolled,
            COALESCE(v.remaining, cs.capacity) AS remaining
        FROM class_sections AS cs
        JOIN courses AS c ON cs.course_code = c.code
        LEFT JOIN lecturers AS l ON cs.lecturer_id = l.id
        LEFT JOIN v_section_summary AS v ON cs.id = v.class_id
        WHERE UPPER(cs.id) = :section_id
    """
    with engine.connect() as connection:
        row = connection.execute(
            text(sql), 
            {"section_id": section_id.upper()}
        ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Khong tim thay lop hoc phan",
        )
    return dict(row)


# Bài 3: PATCH /sections/{section_id}/capacity - Cập nhật sức chứa
@app.patch("/sections/{section_id}/capacity")
def update_section_capacity(
    section_id: str, 
    payload: UpdateCapacityRequest
) -> dict[str, object]:
    sec_id = section_id.upper()
    
    with engine.begin() as connection:
        # 1. Kiểm tra lớp có tồn tại hay không
        section_sql = """
            SELECT cs.id, cs.capacity, COALESCE(v.enrolled, 0) AS enrolled
            FROM class_sections AS cs
            LEFT JOIN v_section_summary AS v ON cs.id = v.class_id
            WHERE UPPER(cs.id) = :section_id
        """
        section = connection.execute(text(section_sql), {"section_id": sec_id}).mappings().first()
        
        if section is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Khong tim thay lop hoc phan",
            )
            
        # 2. Kiểm tra: capacity mới không nhỏ hơn số sinh viên đã đăng ký
        if payload.capacity < section["enrolled"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Suc chua ({payload.capacity}) khong duoc nho hon so sinh vien da dang ky ({section['enrolled']})",
            )
            
        # 3. Cập nhật sức chứa mới
        update_sql = "UPDATE class_sections SET capacity = :capacity WHERE UPPER(id) = :section_id"
        connection.execute(text(update_sql), {"capacity": payload.capacity, "section_id": sec_id})
        
    return {
        "message": "Cap nhat suc chua thanh cong",
        "section_id": sec_id,
        "new_capacity": payload.capacity
    }


# Bài 4: GET /courses - Cập nhật Phân trang & Tìm kiếm
@app.get("/courses")
def list_courses(
    q: Optional[str] = Query(default=None, min_length=1),
    skip: int = Query(default=0, ge=0, description="Số bản ghi bỏ qua (>=0)"),
    limit: int = Query(default=10, ge=1, le=100, description="Số lượng bản ghi lấy (1-100)"),
) -> list[dict[str, object]]:
    sql = "SELECT code, name, credits FROM courses"
    parameters: dict[str, object] = {"skip": skip, "limit": limit}

    if q is not None:
        keyword = q.strip().lower()
        if not keyword:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tu khoa tim kiem khong duoc rong",
            )
        sql += " WHERE LOWER(code) LIKE :keyword OR LOWER(name) LIKE :keyword"
        parameters["keyword"] = f"%{keyword}%"

    # Sắp xếp ổn định theo code trước OFFSET / LIMIT
    sql += " ORDER BY code ASC LIMIT :limit OFFSET :skip"

    with engine.connect() as connection:
        rows = connection.execute(text(sql), parameters).mappings().all()
    return [dict(row) for row in rows]


# Bài tập tự thực hành buổi 4

# Bài 1
from fastapi import Query
from typing import Optional

@app.get("/enrollment-events", status_code=200)
def get_enrollment_events(
    student_id: Optional[str] = None,
    event_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    sql = """
        SELECT id, student_id, class_section_id, event_type, source, dataset, occurred_at
        FROM enrollment_events
        WHERE 1=1
    """
    parameters = {"skip": skip, "limit": limit}

    if student_id:
        sql += " AND student_id = :student_id"
        parameters["student_id"] = student_id
    
    if event_type:
        sql += " AND event_type = :event_type"
        parameters["event_type"] = event_type

    sql += " ORDER BY occurred_at DESC, id DESC LIMIT :limit OFFSET :skip"

    with engine.begin() as connection:
        rows = connection.execute(text(sql), parameters).mappings().all()
    
    return {"events": [dict(row) for row in rows]}
# Bai 2: 
# from sqlalchemy.exc import SQLAlchemyError

# @app.post("/enrollments/demo-fail")
# def create_enrollment_fail(payload: EnrollmentCreate):
#     insert_enrollment_sql = """
#         INSERT INTO enrollments (student_id, class_section_id)
#         VALUES (:student_id, :class_section_id)
#     """
#     # Cố tình truyền event_type = 'LOI_GIA_LAP' để vi phạm ràng buộc CHECK đã tạo ở migration 001
#     event_sql = """
#         INSERT INTO enrollment_events 
#             (student_id, class_section_id, event_type, source, dataset)
#         VALUES 
#             (:student_id, :class_section_id, 'LOI_GIA_LAP', 'api', 'demo')
#     """
#     parameters = {
#         "student_id": payload.student_id,
#         "class_section_id": payload.class_section_id,
#     }

#     try:
#         with engine.begin() as connection:
#             # Lệnh 1: Thêm đăng ký (Sẽ thành công)
#             connection.execute(text(insert_enrollment_sql), parameters)
            
#             # Lệnh 2: Thêm sự kiện (Sẽ bị lỗi vì LOI_GIA_LAP không nằm trong IN ('CREATED', 'CANCELLED'))
#             connection.execute(text(event_sql), parameters)
            
#     except SQLAlchemyError as exc:
#         return {"message": "Transaction da bi rollback", "error": str(exc)}
