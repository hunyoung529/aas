# PDF Generation Backend Server

이 서버는 클라이언트의 요청을 받아 Word DOCX 템플릿의 발급 일시를 수정하고, LibreOffice(soffice)를 사용해 원본 레이아웃 그대로 고품질 PDF로 변환한 후 워터마크를 찍어 반환하는 Node.js Express 백엔드 API 서버입니다.

## 주요 기능

1. **DOCX 템플릿 실시간 치환**: 
   - `templates/report.docx` 내에 명확히 정의된 `{{ISSUED_AT}}` 플레이스홀더를 한국 시간대(Asia/Seoul, YYYY-MM-DD HH:mm 포맷)로 치환합니다.
2. **원클릭 PDF 변환**:
   - `soffice` Headless 컴파일러를 통해 HTML 변환 캡처 방식 대신, 실제 한글 폰트가 유지된 고품질 원본 레이아웃의 PDF 파일을 빌드합니다.
3. **보안/테스트 오버레이 워터마크**:
   - `pdf-lib`와 `NanumGothic` 폰트를 사용하여 생성된 PDF의 모든 페이지 중앙에 투명 대각선 한국어 워터마크(`TEST / 비공식 문서`)를 물리적으로 결합하여 삽입합니다.
4. **완전한 병렬 처리 및 리소스 클리닝**:
   - 요청마다 충돌 방지를 위해 임시 디렉토리 및 고유 LibreOffice 프로필(`lo-profile-xxxxxx`)을 동적으로 생성하며, 변환 직후 모든 임시 데이터가 메모리와 디스크에서 깔끔히 소거됩니다.

---

## 로컬 실행 방법

### 요구사항
- Node.js (v18+)
- LibreOffice (`soffice` 명령어가 환경변수 PATH에 등록되어 있어야 함)

### 실행 단계
1. `server` 디렉토리로 이동합니다.
2. 의존성을 설치합니다.
   ```bash
   npm install
   ```
3. 서버를 시작합니다.
   ```bash
   npm start
   ```
   *서버는 기본적으로 `http://localhost:3000` 포트에서 실행됩니다.*

---

## 서버 배포 가이드

LibreOffice 환경이 설치되어야 하므로 일반적인 서버리스(Vercel 등) 환경보다는 **Docker 지원 컨테이너 서비스(Render, Railway, Cloud Run 등)**에 배포하는 것을 적극 권장합니다.

### 1. Render / Railway 배포 (추천)
서버 디렉토리 안에 배포 환경에 적합한 `Dockerfile`이 이미 작성되어 있습니다.
- 레포지토리를 Render 또는 Railway에 연동한 뒤, 빌드 디렉토리를 `server`로 지정하거나 Dockerfile 빌드 방식으로 배포하면 서버가 자동으로 LibreOffice를 다운로드하여 정상 작동하게 됩니다.

### 2. index.html의 API 주소 갱신
배포 완료 후, 웹사이트 루트의 `index.html` 파일의 약 35번째 줄에 있는 `API_URL`을 배포된 실제 서버 도메인 주소로 교체해 주세요.
```javascript
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/generate-test-report'
  : 'https://배포한-도메인-주소/api/generate-test-report';
```
