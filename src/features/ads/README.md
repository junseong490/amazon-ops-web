# features/ads — 광고 최적화 (Sponsored Products)

SP Bulk Operations(.xlsx) 왕복 최적화. 업로드 → 키워드/타겟 효율·권장 입찰(§5c) →
검색어 기반 신규 키워드·네거티브 제안(선택) → **변경분만 반영한 벌크 xlsx 다운로드**.

## 계층 (I/O ↔ 순수 코어 분리)

- `ingest/readWorkbook.ts` — SheetJS CE로 다중시트 읽기 + 원본 바이트 보관(왕복용).
- `parse/` — 헤더 이름 매핑(위치 인덱스 금지). SP Campaigns / SP Search Term Report.
- `aggregate/metrics.ts` — 순수: ACOS/CPC/CVR/ROAS/CTR/RPC(0분모 null).
- `recommend/bid.ts` — 순수: 권장 입찰. 하방 보수(−15% 기본, bid floor, 비대칭 클램프).
- `recommend/searchTermSuggest.ts` — 순수: 신규/네거티브 후보(등록분 제외).
- `serialize/patchWorkbook.ts` — 왕복 XML 외과수술 패치(fflate). 변경 셀만 교체, 나머지 100% 보존.
- `views/` — 업로드·파라미터·효율표·검색어 제안·생성/다운로드.

## 왕복 원칙

원본 워크북을 fflate로 unzip → SP 시트에서 변경 행의 `Bid`·`Operation="update"`만 교체
(+ 선택된 신규/네거티브 `create` 행 추가) → 재zip. 문자열은 inlineStr로 써 sharedStrings 변경을
피한다. **아마존 최종 수용 검증은 사용자가 Seller Central 소량 시험 업로드로 확인(S7).**

테스트: `tests/ads.test.ts` (합성 픽스처 — 실제 샘플은 커밋 금지).
