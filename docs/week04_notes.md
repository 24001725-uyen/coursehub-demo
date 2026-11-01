# CourseHub - Buoi 4
- Migration 001: enrollment_events.
- Demo class: RACE-01, capacity = 1.
- POST /enrollments: lock class_sections bang FOR UPDATE.
- Concurrency test: 1 request 201, 1 request 409.
- Performance data: 100000 rows, dataset=performance.
- Index: idx_enrollment_events_dataset_student_time.
- Ghi lai scan type va Execution Time truoc/sau o day.


+ Trước khi tạo chỉ mục: 

"Limit  (cost=2913.94..2914.07 rows=50 width=39) (actual time=11.612..11.621 rows=50 loops=1)"
"  Buffers: shared hit=1137"
"  ->  Sort  (cost=2913.94..2915.97 rows=811 width=39) (actual time=11.609..11.615 rows=50 loops=1)"
"        Sort Key: occurred_at DESC"
"        Sort Method: top-N heapsort  Memory: 31kB"
"        Buffers: shared hit=1137"
"        ->  Seq Scan on enrollment_events  (cost=0.00..2887.00 rows=811 width=39) (actual time=0.072..11.308 rows=820 loops=1)"
"              Filter: ((occurred_at >= '2025-12-20 00:00:00'::timestamp without time zone) AND ((dataset)::text = 'performance'::text) AND ((student_id)::text = '22000001'::text))"
"              Rows Removed by Filter: 99180"
"              Buffers: shared hit=1137"
"Planning Time: 0.176 ms"
"Execution Time: 11.658 ms"


+ Sau khi tạo chỉ mục:

"Limit  (cost=0.42..67.63 rows=50 width=39) (actual time=0.201..0.276 rows=50 loops=1)"
"  Buffers: shared hit=50 read=3"
"  ->  Index Scan using idx_enrollment_events_dataset_student_time on enrollment_events  (cost=0.42..1110.82 rows=826 width=39) (actual time=0.199..0.266 rows=50 loops=1)"
"        Index Cond: (((dataset)::text = 'performance'::text) AND ((student_id)::text = '22000001'::text) AND (occurred_at >= '2025-12-20 00:00:00'::timestamp without time zone))"
"        Buffers: shared hit=50 read=3"
"Planning:"
"  Buffers: shared hit=39 read=1"
"Planning Time: 4.792 ms"
"Execution Time: 0.317 ms"