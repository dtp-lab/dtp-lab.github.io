# DTPLab 콘텐츠 업데이트 가이드

모든 JSON 파일은 UTF-8로 저장합니다. 날짜 기반 페이지는 화면에서 최신순으로 다시 정렬하므로 배열 순서에 의존하지 않습니다. `people.json`의 그룹 내부 순서만 화면에 그대로 반영됩니다.

구조화된 로컬 편집기는 별도 Private 저장소 `dtp-lab/lab-website-builder`에서 관리합니다. 편집기는 이 저장소의 로컬 checkout 경로를 명시적으로 받아 JSON과 이미지만 저장하며 Git commit, push, 배포는 수행하지 않습니다.

## 이미지

외부 이미지 URL은 허용하지 않습니다. 이미지를 `site/assets/` 아래에 넣고 다음 형태로 기록합니다.

```json
{ "src": "assets/gallery/example.webp", "alt": "행사 사진 설명", "caption": "선택적 캡션" }
```

People과 Research의 단일 이미지 필드는 로컬 경로 문자열을 사용합니다. 값이 비어 있으면 People은 1:1 빈 프레임을 유지하고, Research·Project·Gallery는 미디어 영역을 렌더링하지 않습니다. Studio에서 Gallery 원본 이미지를 선택하면 WebP 본이미지와 640×360 썸네일을 함께 생성합니다.

## 프로젝트

`site/data/projects.json`의 각 항목은 다음 필드를 사용합니다.

```json
{
  "id": "project-19",
  "status": "current",
  "category": "rnd",
  "title": "과제명",
  "program": "사업명 또는 과제유형",
  "sponsor": "지원·발주기관",
  "managingAgency": "전담·관리기관",
  "period": { "start": "2026.03", "end": "2028.02" },
  "budget": { "amount": "100,000", "unit": "천원" },
  "keywords": ["Digital Twin", "Optimization"],
  "description": "개요",
  "details": ["세부 연구내용 1"],
  "images": []
}
```

`status`는 `current/completed`, `category`는 `industry/rnd/talent` 중 하나입니다. 종료일이 지난 Current 과제는 검증 경고만 출력하며 자동 이동하지 않습니다.

## 논문·학술발표·특허

`site/data/publications.json`은 `items` 배열을 사용합니다. `type`은 `journal/conference/patent`입니다. 저자 역할은 `isLabMember`, `isFirstAuthor`, `isCorrespondingAuthor` 불리언 값으로 기록합니다. 원본 인용문은 `rawCitation`에 유지합니다.

확인된 지표만 `metrics.indexing`, `metrics.quartile`, `metrics.topPercent`, `metrics.award`, `metrics.metricYear`에 기록합니다. DOI는 접두사 없이 `10.xxxx/...` 형태로, Semantic Scholar paper ID는 `semanticScholarId`에 기록합니다. 둘 다 없으면 자동 인용수 조회 대상에서 제외됩니다.

## 통제 키워드

현재 허용된 키워드는 다음과 같습니다.

`Digital Twin`, `Physical AI`, `Sim2Real`, `Robotics`, `Reinforcement Learning`, `Optimization`, `Surrogate Modeling`, `Computer Vision`, `Synthetic Data`, `Energy Systems`, `AI Education`, `World Models`, `Foundation Models`, `Generative AI`, `Localization`, `Control`, `Multimodal AI`, `Scientific Machine Learning`, `Sequence Modeling`, `Resource Allocation`, `Scheduling`, `Deep Learning`, `Extended Reality`

프로젝트와 실적에는 제목·개요에서 확실한 키워드만 최대 5개까지 사용합니다. 세미나는 `keywords` 배열이 필수이며 발표 제목과 요약에 근거한 키워드를 1~4개 사용합니다.

## 확인

수정 후 다음 명령을 실행합니다.

```powershell
node tools/validate-content.mjs
npm run build
node tools/check-links.mjs _site
```
