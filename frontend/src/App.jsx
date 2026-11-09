import { useEffect, useState } from "react";
import { api } from "./api.js";
import Notice from "./components/Notice.jsx";
import SectionTable from "./components/SectionTable.jsx";
import EnrollmentList from "./components/EnrollmentList.jsx";
import StudentForm from "./components/StudentForm.jsx";

const EVENT_PAGE_SIZE = 10;

export default function App() {
  const [draftId, setDraftId] = useState("22000004");
  const [studentId, setStudentId] = useState("22000004");

  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [notice, setNotice] = useState({ kind: "info", text: "" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [courseData, sectionData, enrollmentData] = await Promise.all([
          api("/courses", options),
          api("/sections", options),
          api(`/students/${encodeURIComponent(studentId)}/enrollments`, options),
        ]);

        if (controller.signal.aborted) return;

        setCourses(courseData);
        setSections(sectionData);
        setEnrollments(enrollmentData);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message);
        setCourses([]);
        setSections([]);
        setEnrollments([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadData();

    return () => controller.abort();
  }, [studentId, refresh]);

  useEffect(() => {
    const controller = new AbortController();
    const skip = eventPage * EVENT_PAGE_SIZE;

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError("");

      try {
        const eventData = await api(
          `/enrollment-events?student_id=${encodeURIComponent(studentId)}&dataset=demo&limit=${EVENT_PAGE_SIZE}&skip=${skip}`,
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        setEvents(eventData.events);
        setEventTotal(eventData.total);
      } catch (err) {
        if (controller.signal.aborted) return;
        setEventsError(err.message);
        setEvents([]);
        setEventTotal(0);
      } finally {
        if (!controller.signal.aborted) setEventsLoading(false);
      }
    }

    loadEvents();

    return () => controller.abort();
  }, [studentId, eventPage, refresh]);

  function chooseStudent(event) {
    event.preventDefault();
    const nextId = draftId.trim();

    if (!/^\d{8}$/.test(nextId)) {
      setNotice({ kind: "error", text: "Mã demo phải gồm 8 chữ số." });
      return;
    }

    setNotice({ kind: "info", text: "" });
    setLoading(true);
    setEventPage(0);
    setStudentId(nextId);
    setRefresh((value) => value + 1);
  }

  async function changeEnrollment(sectionId, cancel = false) {
    if (busy || loading || error) return;
    if (cancel && !window.confirm(`Hủy đăng ký lớp ${sectionId}?`)) return;

    setBusy(true);
    setNotice({ kind: "info", text: "Đang gửi yêu cầu..." });

    try {
      if (cancel) {
        await api(
          `/enrollments/${encodeURIComponent(studentId)}/${encodeURIComponent(sectionId)}`,
          { method: "DELETE" }
        );
      } else {
        await api("/enrollments", {
          method: "POST",
          body: { student_id: studentId, class_section_id: sectionId },
        });
      }

      setNotice({
        kind: "success",
        text: cancel
          ? `Đã hủy đăng ký ${sectionId}.`
          : `Đăng ký ${sectionId} thành công.`
      });
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      // Đọc lại CSDL kể cả sau lỗi; không tự cộng/trừ số chỗ ở giao diện.
      setLoading(true);
      setRefresh((value) => value + 1);
      setBusy(false);
    }
  }

  const keyword = search.trim().toLowerCase();

  const rows = sections
    .map((section) => ({
      ...section,
      course_name:
        courses.find((course) => course.code === section.course_code)?.name ??
        section.course_code,
      registered: enrollments.some(
        (item) => item.class_section_id === section.class_id
      ),
    }))
    .filter(
      (row) =>
        (!courseFilter || row.course_code === courseFilter) &&
        `${row.class_id} ${row.course_code} ${row.course_name}`
          .toLowerCase()
          .includes(keyword) &&
        (!onlyAvailable || row.remaining > 0)
    );

  const disabled = loading || busy || Boolean(error);
  const eventPageCount = Math.max(1, Math.ceil(eventTotal / EVENT_PAGE_SIZE));

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">CSDL WEB VÀ HỆ THỐNG THÔNG TIN · BUỔI 5</p>
        <h1>CourseHub</h1>
        <p>Tra cứu và đăng ký lớp học phần</p>
        <span className="chip">React → FastAPI → PostgreSQL</span>
      </header>

      <p className="demo-note">
        Môi trường thực hành. Nhập mã sinh viên để thử dữ liệu, không phải đăng nhập.
      </p>

      <section className="panel">
        <h2>1. Chọn sinh viên</h2>
        <StudentForm
          draftId={draftId}
          studentId={studentId}
          busy={busy}
          loading={loading}
          onDraftChange={setDraftId}
          onSubmit={chooseStudent}
          onRefresh={() => setRefresh((value) => value + 1)}
        />
      </section>

      <Notice kind={notice.kind}>{notice.text}</Notice>
      <Notice kind="error">{error}</Notice>
      {loading && <Notice>Đang tải dữ liệu từ API...</Notice>}

      {!loading && !error && (
        <div className="workspace">
          <section className="panel">
            <h2>2. Danh sách lớp học phần</h2>
            <div className="filters">
              <label htmlFor="search">Tìm lớp / học phần</label>
              <input
                id="search"
                value={search}
                placeholder="Ví dụ: web"
                onChange={(e) => setSearch(e.target.value)}
              />
              <label htmlFor="course-filter" className="sr-only">
                Lọc theo học phần
              </label>
              <select
                id="course-filter"
                aria-label="Lọc theo học phần"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="">Tất cả học phần</option>
                {courses.map((course) => (
                  <option key={course.code} value={course.code}>
                    {course.code} - {course.name}
                  </option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                Chỉ hiện lớp còn chỗ
              </label>
            </div>
            <SectionTable
              rows={rows}
              disabled={disabled}
              onEnroll={(id) => changeEnrollment(id)}
            />
          </section>

          <section className="panel">
            <h2>3. Lớp đã đăng ký</h2>
            <p className="muted">
              Sinh viên {studentId} · {enrollments.length} lớp
            </p>
            <EnrollmentList
              rows={enrollments}
              disabled={disabled}
              onCancel={(id) => changeEnrollment(id, true)}
            />
          </section>

          <section className="panel">
            <h2>4. Lịch sử đăng ký</h2>
            <p className="muted">
              Nhật ký demo của sinh viên {studentId} · {eventTotal} sự kiện
            </p>
            <Notice kind="error">{eventsError}</Notice>
            {eventsLoading ? (
              <p role="status">Đang tải nhật ký...</p>
            ) : eventsError ? null : events.length === 0 ? (
              <p className="muted">Chưa có sự kiện demo.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Lớp học phần</th>
                    <th scope="col">Sự kiện</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.occurred_at).toLocaleString("vi-VN")}</td>
                      <td>{item.class_section_id}</td>
                      <td>{item.event_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="filters">
              <button
                type="button"
                disabled={eventPage === 0 || eventsLoading}
                onClick={() => setEventPage((page) => page - 1)}
              >
                Trang trước
              </button>
              <span aria-live="polite">
                Trang {eventPage + 1} / {eventPageCount}
              </span>
              <button
                type="button"
                disabled={eventPage + 1 >= eventPageCount || eventsLoading}
                onClick={() => setEventPage((page) => page + 1)}
              >
                Trang sau
              </button>
            </div>
          </section>
        </div>
      )}

      <footer>
        Số chỗ và đăng ký được đọc từ API; Backend quyết định tính hợp lệ.
      </footer>
    </main>
  );
}