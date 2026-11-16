import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/api.js";

describe("Tập kiểm thử hàm api() trong src/api.js", () => {
  const originalFetch = globalThis.fetch;

  // Khôi phục fetch gốc sau mỗi bài test
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Tình huống 1: Request GET thành công, parse JSON trả về
  test("1. GET thành công trả về dữ liệu JSON", async () => {
    const mockData = [{ code: "INT2204", name: "Cơ sở dữ liệu Web" }];
    
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/courses$/);
      assert.equal(options.method, "GET");
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockData),
      };
    };

    const result = await api("/courses");
    assert.deepEqual(result, mockData);
  });

  // Tình huống 2: Request POST với body JSON thành công
  test("2. POST gửi JSON body thành công", async () => {
    const payload = { student_id: "22000004", class_section_id: "WEB-01" };
    
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/enrollments$/);
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.equal(options.body, JSON.stringify(payload));
      return {
        status: 201,
        ok: true,
        text: async () => JSON.stringify({ message: "Đăng ký thành công" }),
      };
    };

    const result = await api("/enrollments", { method: "POST", body: payload });
    assert.deepEqual(result, { message: "Đăng ký thành công" });
  });

  // Tình huống 3: Request DELETE thành công trả về HTTP 204 (No Content)
  test("3. DELETE trả về HTTP 204 No Content (trả về null)", async () => {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/enrollments\/22000004\/WEB-01$/);
      assert.equal(options.method, "DELETE");
      return {
        status: 204,
        ok: true,
      };
    };

    const result = await api("/enrollments/22000004/WEB-01", { method: "DELETE" });
    assert.equal(result, null);
  });

  // Tình huống 4: Thất bại do lỗi kết nối mạng / CORS (fetch throw Exception)
  test("4. Xử lý lỗi mạng hoặc CORS khi fetch ném ngoại lệ", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    await assert.rejects(
      async () => {
        await api("/courses");
      },
      (err) => {
        assert.match(err.message, /Không nhận được phản hồi API/);
        return true;
      }
    );
  });

  // Tình huống 5: Tác vụ bị hủy bởi AbortController (AbortError)
  test("5. Giữ nguyên AbortError khi request bị AbortController hủy", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    globalThis.fetch = async () => {
      throw abortError;
    };

    await assert.rejects(
      async () => {
        await api("/courses");
      },
      (err) => {
        assert.equal(err.name, "AbortError");
        return true;
      }
    );
  });

  // Tình huống 6: Response lỗi và phản hồi không phải định dạng JSON (VD: 500 HTML)
  test("6. Báo lỗi khi phản hồi từ server không phải định dạng JSON", async () => {
    globalThis.fetch = async () => {
      return {
        status: 500,
        ok: false,
        text: async () => "<html>Internal Server Error</html>",
      };
    };

    await assert.rejects(
      async () => {
        await api("/courses");
      },
      (err) => {
        assert.match(err.message, /HTTP 500: phản hồi không phải JSON/);
        return true;
      }
    );
  });

  // Tình huống 7: Lỗi HTTP trả về detail dạng chuỗi (VD: HTTP 409 Xung đột)
  test("7. Bắt lỗi HTTP 409 với thông báo detail dạng chuỗi", async () => {
    globalThis.fetch = async () => {
      return {
        status: 409,
        ok: false,
        text: async () => JSON.stringify({ detail: "Lớp học phần đã hết chỗ" }),
      };
    };

    await assert.rejects(
      async () => {
        await api("/enrollments", { method: "POST", body: {} });
      },
      (err) => {
        assert.equal(err.message, "HTTP 409: Lớp học phần đã hết chỗ");
        assert.equal(err.status, 409);
        return true;
      }
    );
  });

  // Tình huống 8: Lỗi HTTP 422 từ FastAPI chứa detail dạng mảng các lỗi validation
  test("8. Bắt lỗi HTTP 422 với detail dạng mảng validation từ FastAPI", async () => {
    const fastapiValidationError = {
      detail: [
        { msg: "field required" },
        { msg: "value is not a valid integer" },
      ],
    };

    globalThis.fetch = async () => {
      return {
        status: 422,
        ok: false,
        text: async () => JSON.stringify(fastapiValidationError),
      };
    };

    await assert.rejects(
      async () => {
        await api("/enrollments", { method: "POST" });
      },
      (err) => {
        assert.equal(
          err.message,
          "HTTP 422: field required; value is not a valid integer"
        );
        assert.equal(err.status, 422);
        return true;
      }
    );
  });
});