# DTPLab website

부산대학교 Digital Twin Physical AI Laboratory의 정적 멀티페이지 홈페이지입니다. 기존 Google Sites의 내용을 `Home / People / Projects / Publications / Seminars / Gallery`로 이전했으며, EJS 공통 템플릿을 정적 HTML로 빌드해 [https://dtp-lab.github.io/](https://dtp-lab.github.io/)에 배포합니다.

## 공개 페이지

- `templates/pages/`: 6개 공개 페이지와 archive 호환 리다이렉트의 EJS 원본
- `templates/partials/`: 공통 head, header, footer
- `site/`: CSS, JavaScript, JSON, 로컬 이미지 등 정적 자산
- `_site/`: `npm run build`가 생성하는 배포 결과물로 Git에는 포함하지 않음
- 공개 경로는 `/people/`, `/projects/`처럼 디렉터리 기반의 확장자 없는 URL을 사용

## 데이터

콘텐츠는 `site/data/` 아래의 JSON으로 관리합니다. 실제 프로필·행사 이미지는 추후 로컬 파일로 추가하며, 외부 Google Sites 이미지 URL은 사용하지 않습니다.

`tools/content-model.mjs`는 구조화된 편집기에서 사용할 수 있는 직렬화 가능한 필드 계약과 저장 전 검증 함수를 제공합니다. 실제 편집 UI는 별도 Private 저장소 `dtp-lab/lab-website-builder`에서 관리합니다.

- `home.json`: 모집 안내
- `news.json`: 48건의 연구실 뉴스
- `research.json`: 4대 연구분야
- `people.json`: 연구원 프로필
- `projects.json`: 구조화된 18개 프로젝트
- `publications.json`: 구조화된 논문·학술발표·특허 84건
- `citations.json`: Semantic Scholar 인용수 캐시
- `seminars.json`: 키워드를 포함한 73건의 세미나
- `gallery.json`: 9건의 행사와 레이아웃 점검용 샘플 이벤트

## 로컬 확인

먼저 정적 배포물을 빌드한 뒤 로컬 서버를 사용합니다. 브라우저의 `file://` 경로에서는 JSON 로딩이 제한됩니다.

```powershell
npm ci
npm run build
npm run serve
```

검증 명령:

```powershell
npm run validate
```

## 배포

`main` 브랜치 push 또는 매주 월요일 예약 실행 시 GitHub Actions가 의존성 설치, 인용수 캐시 갱신, 데이터 검증, EJS 정적 빌드, 내부 링크 검사를 순서대로 수행합니다. 어느 단계라도 실패하면 새 Pages 배포가 진행되지 않아 마지막 정상 배포가 유지됩니다. Semantic Scholar ID 또는 DOI가 없는 실적은 인용수 항목을 표시하지 않습니다.

상세한 콘텐츠 수정 방법은 [CONTENT_UPDATE_GUIDE.md](CONTENT_UPDATE_GUIDE.md)를 참고하십시오.
