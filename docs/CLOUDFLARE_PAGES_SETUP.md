# 🚀 Cloudflare Pages - GitHub 자동 배포 설정 가이드

**작성일**: 2026-01-02
**상태**: GitHub 자동 배포 추천

---

## ⚠️ 배포 이슈

### 문제점
- **wrangler pages deploy**: Next.js 16과 호환성 문제로 404 에러 발생
- **@cloudflare/next-on-pages**: Next.js 15.x까지만 지원

### 해결 방안
✅ **GitHub 자동 배포 사용** - Cloudflare가 공식 지원하는 Next.js 16 배포 방법

---

## 📋 GitHub 자동 배포 설정 (추천)

### 1단계: Cloudflare Dashboard 접속

https://dash.cloudflare.com

### 2단계: Pages 프로젝트 설정

1. **Workers & Pages** 메뉴 클릭
2. **felix-radio** 프로젝트 선택
3. **Settings** → **Builds & deployments** 탭

### 3단계: GitHub 연결

1. **"Connect to Git"** 버튼 클릭 (또는 "Configure build settings")
2. GitHub 연결 승인
3. 저장소 선택: **7wario-sudo/felix-radio**
4. Branch 선택: **main**

### 4단계: 빌드 설정 구성

```bash
# Production Branch
main

# Build command
cd apps/web && npm install && npm run build

# Build output directory
apps/web/.next

# Root directory (Path)
/

# Node version
20
```

### 5단계: 환경 변수 설정

Production 환경 변수 추가:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_API_URL=https://felix-radio-api.7wario.workers.dev
NODE_VERSION=20
```

### 6단계: 저장 및 배포

1. **"Save and Deploy"** 클릭
2. 자동으로 빌드 시작
3. 빌드 로그에서 진행상황 확인
4. 완료 후 배포 URL 확인

---

## 🔄 자동 배포 워크플로우

### Git Push → 자동 배포

```bash
# 로컬에서 작업
git add .
git commit -m "feat: add new feature"
git push origin main

# Cloudflare Pages가 자동으로:
# 1. GitHub에서 코드 pull
# 2. npm install 실행
# 3. npm run build 실행
# 4. .next 폴더 배포
# 5. 새로운 URL 생성
```

### Preview 배포

- PR 생성 시 자동으로 preview deployment 생성
- PR 브랜치마다 별도 URL 제공
- PR 머지 후 production 자동 배포

---

## 📊 현재 배포 상태

### wrangler deploy 배포 (404 에러)
```
❌ https://5e07968f.felix-radio.pages.dev (404)
❌ https://2d98abac.felix-radio.pages.dev (404)
❌ https://37e8e0a4.felix-radio.pages.dev (404)
```

### 대기 중: GitHub 자동 배포
```
⏳ Git 연결 필요
⏳ 빌드 설정 필요
✅ 설정 완료 후 자동 배포됨
```

---

## ✅ 설정 체크리스트

### Cloudflare Dashboard 설정
- [ ] Workers & Pages → felix-radio 접속
- [ ] Settings → Builds & deployments
- [ ] Connect to Git 클릭
- [ ] GitHub 저장소 연결: 7wario-sudo/felix-radio
- [ ] Build command 설정: `cd apps/web && npm install && npm run build`
- [ ] Build output 설정: `apps/web/.next`
- [ ] 환경 변수 추가 (4개)
- [ ] Save and Deploy 클릭

### 배포 후 확인
- [ ] 빌드 로그 확인 (성공 여부)
- [ ] 배포 URL 확인
- [ ] 사이트 정상 작동 확인
- [ ] 로그인/회원가입 테스트
- [ ] Dashboard 접근 테스트

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
