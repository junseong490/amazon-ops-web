# amazon-ops-web

아마존 셀러 운영 보조 웹앱. MVP 1차 = **매출 대시보드** (All Orders 주문 리포트 업로드 → 국가별·품목별·일별 매출).

- 클라이언트 사이드 웹앱(브라우저 내 파싱·집계, 백엔드 없음). 데이터는 브라우저를 벗어나지 않는다.
- 무료 정적 호스팅(GitHub Pages) 목표. 추가 과금 없음.
- 설계 근거·스키마: 하네스 태스크 `2026-08-16-amazon-ops-web`(plan.md / review.md / reference-order-report-schema.md).

> ⚠️ 실제 셀러 재무·PII 데이터 샘플을 이 저장소에 커밋하지 말 것(.gitignore의 sample-data/ 사용).
