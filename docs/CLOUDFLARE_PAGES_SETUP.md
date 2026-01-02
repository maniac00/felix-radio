# 🚀 Cloudflare Pages - 배포 가이드

**작성일**: 2026-01-02 (업데이트)
**참고**: [Cloudflare Pages 공식 문서](https://developers.cloudflare.com/pages/)

---

## 📊 현재 상태

- **프로젝트**: felix-radio (이미 생성됨)
- **도메인**: felix-radio.pages.dev
- **Git 연결**: No (Direct Upload 모드)
- **배포 방식**: wrangler pages deploy

---

## ⚠️ 배포 옵션

Cloudflare Pages는 두 가지 배포 방식을 제공합니다:

### 옵션 1: Git Integration (GitHub 자동 배포)
- Git push 시 자동 배포
- PR마다 Preview 배포
- ⚠️ **중요**: Git Integration으로 변경하면 Direct Upload로 되돌릴 수 없음

### 옵션 2: Direct Upload (현재 방식)
- wrangler를 통한 수동 배포
- 로컬 빌드 필요
- CI/CD 파이프라인 커스터마이징 가능

---

## 🔄 옵션 1: Git Integration으로 전환 (신규 프로젝트 생성 필요)

### ⚠️ 주의사항
기존 `felix-radio` 프로젝트는 Direct Upload로 생성되었습니다. Git Integration을 사용하려면:
1. 기존 프로젝트 삭제 또는
2. 새 프로젝트 이름으로 생성 (예: `felix-radio-v2`)

### Git Integration 설정 단계

#### 1단계: 새 프로젝트 생성
1. https://dash.cloudflare.com 접속
2. **Workers & Pages** → **Create application**
3. **Pages** → **Connect to Git** 선택

#### 2단계: GitHub 인증
1. GitHub 계정으로 로그인
2. Cloudflare Pages 앱 설치 승인
3. 저장소 접근 권한 부여

#### 3단계: 저장소 선택
1. 저장소: **7wario-sudo/felix-radio** 선택
2. **Install & Authorize** 클릭
3. **Begin setup** 클릭

#### 4단계: 빌드 설정
**Set up builds and deployments** 페이지에서 구성:

```
Project name: felix-radio-git (또는 원하는 이름)
Production branch: main
Framework preset: Next.js
Build command: pnpm install && cd apps/web && npx @cloudflare/next-on-pages@1
Build output directory: apps/web/.vercel/output/static
Root directory: /
```

**⚠️ 중요**:
- Next.js 15.5.2까지만 @cloudflare/next-on-pages에서 지원됩니다
- Build command는 반드시 `npx @cloudflare/next-on-pages@1`를 사용해야 합니다
- Output directory는 `.vercel/output/static`입니다 (`.next`가 아님)

#### 5단계: Clerk 프로덕션 인스턴스 설정

**⚠️ 중요**: 프로덕션 배포 전 반드시 Clerk 프로덕션 인스턴스를 생성해야 합니다.

1. https://dashboard.clerk.com 접속
2. 인스턴스 선택기에서 **Create production instance** 클릭
3. 개발 설정 복사 또는 새로 시작 선택
4. **API Keys** 탭에서 프로덕션 키 확인:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: `pk_live_...`
   - `CLERK_SECRET_KEY`: `sk_live_...`

#### 6단계: 환경 변수 설정

Build configuration 아래 **Environment variables (advanced)** 섹션에서 추가:

**⚠️ Production 환경에 설정하세요 (Preview는 선택사항)**

```bash
# Clerk Authentication (Production keys from step 5)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_클러xxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_클러xxxxxxxxxxxxxxxxx

# API Configuration
NEXT_PUBLIC_API_URL=https://felix-radio-api.7wario.workers.dev

# App URL (배포 후 실제 URL로 업데이트 필요)
NEXT_PUBLIC_APP_URL=https://felix-radio.pages.dev

# Node version
NODE_VERSION=20
```

#### 7단계: 저장 및 배포

1. **"Save and Deploy"** 클릭
2. 첫 빌드 자동 시작
3. 빌드 로그에서 진행 상황 확인
4. 성공 시 production URL 생성 (예: `https://felix-radio.pages.dev`)

#### 8단계: Clerk Allowed Origins 설정 (배포 성공 후)

**⚠️ 필수**: 배포 성공 후 Clerk에서 프로덕션 도메인을 허용해야 합니다.

1. https://dashboard.clerk.com 접속
2. 프로덕션 인스턴스 선택
3. **Settings** → **Allowed Origins** 이동
4. 프로덕션 URL 추가:
   ```
   https://felix-radio.pages.dev
   또는
   https://your-custom-domain.com
   ```
5. **Save** 클릭

#### 9단계: NEXT_PUBLIC_APP_URL 업데이트 (선택사항)

실제 배포 URL이 확정되면 Cloudflare Pages 환경 변수 업데이트:

1. Settings → Environment variables
2. `NEXT_PUBLIC_APP_URL` 값을 실제 URL로 변경
3. Deployments → 최신 배포에서 **Retry deployment** 클릭

---

## 🛠️ 옵션 2: Direct Upload 계속 사용 (권장)

현재 프로젝트는 Direct Upload 방식으로 설정되어 있습니다. wrangler를 통한 배포 방법:

### 배포 명령어

```bash
cd apps/web

# 1. 빌드
npm run build

# 2. 배포
npx wrangler pages deploy .next --project-name=felix-radio
```

### 404 에러 해결 (Next.js Static Export)

Next.js 앱을 정적 사이트로 export하여 배포:

#### 1. next.config.ts 수정

```typescript
const nextConfig: NextConfig = {
  output: 'export',  // Static export 활성화
  images: {
    unoptimized: true,
  },
};
```

#### 2. 빌드 및 배포

```bash
npm run build  # out 디렉토리 생성
npx wrangler pages deploy out --project-name=felix-radio
```

### ⚠️ Static Export 제한사항

- Server-side rendering (SSR) 사용 불가
- API Routes 사용 불가
- Dynamic Routes는 빌드 시 생성되어야 함
- Middleware는 정적 파일로 컴파일됨

**Felix Radio는 Clerk 인증과 동적 기능을 사용하므로 Static Export는 적합하지 않습니다.**

---

## ✅ 추천 방안: Git Integration 신규 프로젝트

### 이유
1. Next.js 16 SSR 완전 지원
2. 자동 빌드 & 배포
3. PR Preview 배포
4. 서버 컴포넌트 및 Middleware 지원

### 진행 방법
1. Cloudflare Dashboard에서 **새 프로젝트** 생성
2. **Connect to Git** 선택
3. GitHub 저장소 연결
4. 빌드 설정 및 환경 변수 추가
5. 자동 배포 시작

---

## 📊 배포 상태

### Direct Upload 배포 (404 - 호환성 이슈)
```
❌ https://5e07968f.felix-radio.pages.dev (Next.js 16 SSR 미지원)
```

### Git Integration (권장)
```
⏳ 새 프로젝트 생성 필요
✅ 설정 후 자동 배포됨
```

---

## ✅ Git Integration 설정 체크리스트

### 새 프로젝트 생성 (추천)
- [ ] https://dash.cloudflare.com 접속
- [ ] Workers & Pages → **Create application** 클릭
- [ ] Pages → **Connect to Git** 선택
- [ ] GitHub 로그인 및 Cloudflare Pages 앱 승인
- [ ] 저장소 선택: **7wario-sudo/felix-radio**
- [ ] **Install & Authorize** → **Begin setup** 클릭
- [ ] 프로젝트 이름: `felix-radio-git` (또는 원하는 이름)
- [ ] Production branch: `main`
- [ ] Build command: `cd apps/web && npm install && npm run build`
- [ ] Build output: `apps/web/.next`
- [ ] Root directory: `/`
- [ ] 환경 변수 4개 추가
- [ ] **Save and Deploy** 클릭

### 배포 후 확인
- [ ] 빌드 로그 확인 (성공 여부)
- [ ] Production URL 확인 (`https://felix-radio-git.pages.dev`)
- [ ] 사이트 정상 작동 확인
- [ ] 로그인/회원가입 테스트
- [ ] Dashboard 접근 테스트
- [ ] API 연동 확인

---

## 🎯 예상 배포 URL

GitHub 자동 배포 후 URL 형식:

```
Production: https://felix-radio.pages.dev
Custom Domain: https://app.felix-radio.com (설정 시)
```

---

## 🔧 트러블슈팅

### 빌드 실패 시

**문제**: `Module not found` 에러
**해결**: Build command에 `npm install` 포함 확인

**문제**: Environment variables 미적용
**해결**: Settings → Environment variables에서 Production 환경에 추가

**문제**: 404 에러
**해결**: Build output directory가 `apps/web/.next` 인지 확인

### 환경 변수 업데이트

1. Settings → Environment variables
2. 변수 수정
3. **Save** 클릭
4. Settings → Builds & deployments
5. **Retry deployment** 클릭 (최신 배포에서)

---

## 📚 참고 자료

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Next.js on Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Build Configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)

---

## 💡 추가 최적화 (선택사항)

### Custom Domain 설정
1. Settings → Custom domains
2. Add custom domain
3. DNS 레코드 추가
4. SSL 인증서 자동 발급 대기

### Preview Deployments
- PR 생성 시 자동 preview URL 생성
- PR 코멘트에 URL 자동 추가
- 팀 리뷰 용이

### Analytics 활성화
- Settings → Analytics
- Web Analytics 활성화
- 방문자 통계 확인

---

**다음 단계**: Cloudflare Dashboard에서 GitHub 자동 배포 설정

**설정 URL**: https://dash.cloudflare.com → Workers & Pages → felix-radio → Settings
