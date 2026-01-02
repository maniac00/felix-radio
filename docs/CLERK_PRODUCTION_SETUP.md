# 🔐 Clerk Production 설정 가이드

**작성일**: 2026-01-02
**업데이트**: 2026-01-02 (Vercel 배포로 전환)
**참고**: [Clerk Production Deployment](https://clerk.com/docs/guides/development/deployment/production)

---

## 📋 개요

Felix Radio 프로젝트의 Clerk 인증을 Production 모드로 전환하는 가이드입니다.
**현재 배포 환경**: Vercel (felix-radio-web-i3da.vercel.app)

---

## ✅ 설정 완료 현황

### 완료된 작업
- [x] Clerk Production keys 발급
  - Publishable: `pk_live_Y2xlcmsuN3dhcmlvLndvcmtlcnMuZGV2JA`
  - Secret: `sk_live_••••••••••••••••••••••••••••••••••••••••`
- [x] Cloudflare Workers API에 Production secret key 설정
- [x] 로컬 환경변수 파일 업데이트 (.env.local, .dev.vars)
- [x] 로그아웃 리디렉션 경로 수정 (/sign-in → /login)
- [x] Google OAuth 이메일 필수 설정
- [x] Mock 모드 제거

### 진행 중인 작업
- [ ] **Vercel 환경변수 설정** ⬅️ 다음 단계
- [ ] Clerk Dashboard 도메인 설정
- [ ] 프로덕션 배포 및 테스트

---

## 🚀 즉시 실행: Vercel 환경변수 설정

### 1단계: Vercel Dashboard 접속
1. https://vercel.com/dashboard 접속
2. `felix-radio-web` 프로젝트 선택
3. **Settings** → **Environment Variables** 메뉴

### 2단계: 불필요한 환경변수 삭제
다음 환경변수들이 존재하면 **삭제**:
- `NEXT_PUBLIC_CLERK_FRONTEND_API`
- `CLERK_FRONTEND_API`

**이유**: Clerk 기본 도메인을 사용하므로 커스텀 Frontend API 불필요

### 3단계: Production 환경변수 추가/업데이트

#### NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```
Name: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
Value: pk_live_Y2xlcmsuN3dhcmlvLndvcmtlcnMuZGV2JA
Environment: Production ✓
```

#### CLERK_SECRET_KEY
```
Name: CLERK_SECRET_KEY
Value: sk_live_••••••••••••••••••••••••••••••••••••••••
Environment: Production ✓
```

### 4단계: 저장 및 재배포
1. **Save** 클릭
2. **Deployments** 탭으로 이동
3. 최신 배포를 **Redeploy** 클릭 (또는 자동 재배포 대기)

---

## 📝 Clerk Dashboard 설정

### 1단계: Production 인스턴스 선택
1. https://dashboard.clerk.com 접속
2. 좌측 상단에서 **Production** 환경 선택

### 2단계: Domains 설정 (건너뛰기)
**⚠️ 중요: Vercel의 `.vercel.app` 도메인은 Clerk Production에서 사용 불가**

**Settings** → **Domains** 메뉴는 **설정하지 않음**

**이유:**
- Vercel 기본 도메인(`.vercel.app`)은 Clerk Production 정책상 허용되지 않음
- Clerk 기본 도메인(`*.clerk.accounts.dev`)이 자동으로 사용됨
- 커스텀 도메인 없이도 정상 작동

**참고:** 실제 도메인 구매 시에만 Domains 설정 필요

### 3단계: Paths 설정
**Configure** → **Paths** 메뉴

```
Sign-in URL: /login
Sign-up URL: /signup
After sign-in URL: /dashboard
After sign-up URL: /dashboard
Home URL: /
```

### 4단계: Google OAuth 설정
**Configure** → **SSO Connections** → **Google** 메뉴

#### Email Scope 확인
- Email scope가 활성화되어 있는지 확인
- 이메일 정보가 JWT 토큰에 포함되도록 설정
- "Include email addresses in JWT" 옵션 활성화

---

## 🔑 Production Keys 정보

### Frontend (Public)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuN3dhcmlvLndvcmtlcnMuZGV2JA
```

### Backend (Secret)
```bash
CLERK_SECRET_KEY=sk_live_••••••••••••••••••••••••••••••••••••••••
```

**⚠️ 주의**: Secret Key는 절대 클라이언트 코드나 공개 저장소에 노출하지 마세요.

---

## 🌍 환경별 설정 현황

### Local Development

**파일**: `/apps/web/.env.local`
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuN3dhcmlvLndvcmtlcnMuZGV2JA
CLERK_SECRET_KEY=sk_live_••••••••••••••••••••••••••••••••••••••••
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_USE_MOCK_API=false
```

**파일**: `/apps/api/.dev.vars`
```bash
CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuN3dhcmlvLndvcmtlcnMuZGV2JA
CLERK_SECRET_KEY=sk_live_••••••••••••••••••••••••••••••••••••••••
INTERNAL_API_KEY=dev_api_key_12345
```

### Cloudflare Workers (Production API)
```bash
# Wrangler secret (설정 완료)
✓ CLERK_SECRET_KEY=sk_live_••••••••••••••••••••••••••••••••••••••••
```

**확인 방법**:
```bash
cd apps/api
pnpm wrangler secret list
```

### Vercel (Production Frontend)
```bash
# 설정 필요 (위의 "Vercel 환경변수 설정" 참조)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuN3dhcmlvLndvcmtlcnMuZGV2JA
CLERK_SECRET_KEY=sk_live_••••••••••••••••••••••••••••••••••••••••
```

---

## ✅ 테스트 체크리스트

배포 완료 후 다음 항목들을 확인:

### 인증 테스트
- [ ] `/login` 페이지 접속 확인
- [ ] Google OAuth 로그인 동작 확인
- [ ] 로그인 후 `/dashboard`로 리디렉션 확인
- [ ] 로그아웃 후 `/login`으로 리디렉션 확인 (404 에러 없음)

### API 테스트
- [ ] 스케줄 목록 조회 (GET /api/schedules)
- [ ] 스케줄 생성 (POST /api/schedules)
- [ ] 사용자 이메일 정보 정상 저장 확인
- [ ] 녹음 파일 다운로드 동작 확인

### 브라우저 콘솔 확인
- [ ] Clerk 로딩 에러 없음
- [ ] "development keys" 경고 사라짐 ✓
- [ ] CORS 에러 없음
- [ ] "Failed to load Clerk" 에러 없음

---

## 🚨 문제 해결

### 문제 1: "Failed to load Clerk" CORS 에러
**증상**:
```
Access to script at 'https://clerk.7wario.workers.dev/...' blocked by CORS policy
```

**원인**: 커스텀 Frontend API 설정으로 인한 문제

**해결**:
1. Vercel 환경변수에서 `NEXT_PUBLIC_CLERK_FRONTEND_API` 삭제
2. Vercel 환경변수에서 `CLERK_FRONTEND_API` 삭제
3. Redeploy
4. 브라우저 캐시 삭제

### 문제 2: "Invalid token: missing email" 401 에러
**증상**: API 요청 시 401 Unauthorized

**원인**: Clerk JWT 토큰에 이메일 정보 없음

**해결**:
1. Clerk Dashboard → Configure → Email 설정 확인
2. Google OAuth에서 email scope 권한 확인
3. 토큰 재발급 (로그아웃 후 재로그인)

### 문제 3: 스케줄 생성 실패 (UNIQUE constraint)
**증상**:
```
Error: D1_ERROR: UNIQUE constraint failed: users.email
```

**원인**: 이메일 중복 또는 빈 이메일 충돌

**해결**:
1. 데이터베이스에서 빈 이메일 사용자 확인:
```bash
pnpm wrangler d1 execute felix-radio-db --remote \
  --command "SELECT id, email FROM users WHERE email = '';"
```
2. 필요시 기존 사용자 삭제 또는 이메일 업데이트
3. API 코드에서 이메일 필수 검증 확인됨 ✓

### 문제 4: "development keys" 경고 표시
**증상**: 브라우저 콘솔에 development keys 경고

**원인**: `pk_test_` 키 사용 중

**해결**:
1. Vercel 환경변수 확인: `pk_live_`로 시작하는지 확인
2. 재배포 후 확인

---

## 🔄 Google Cloud Console 설정

Google OAuth 사용 시 Google Cloud Console에서도 설정 필요:

### OAuth 2.0 Client ID 설정
1. https://console.cloud.google.com 접속
2. APIs & Services → Credentials
3. OAuth 2.0 Client ID 선택

#### Authorized JavaScript origins
```
https://felix-radio-web-i3da.vercel.app
http://localhost:3000
```

#### Authorized redirect URIs
Clerk Dashboard에서 제공하는 callback URL 복사 후 추가
(형식: `https://[clerk-domain]/v1/oauth_callback`)

---

## 📊 모니터링

### Clerk Dashboard
1. https://dashboard.clerk.com 접속
2. **Monitor** → **Logs** 메뉴
3. 실시간 인증 요청 및 에러 확인

### Cloudflare Workers
```bash
cd /Users/kimsungwook/dev/felix-radio/apps/api
pnpm wrangler tail
```

실시간 API 요청 및 에러 로그 확인

### Vercel
1. Vercel Dashboard → felix-radio-web 프로젝트
2. **Logs** 메뉴
3. Runtime logs 및 Function logs 확인

---

## 🎯 향후 개선사항 (선택사항)

### 커스텀 도메인 사용
현재는 Clerk 기본 도메인을 사용하고 있습니다.
완전한 브랜딩을 원한다면 실제 도메인 구매 후 설정 고려:

#### 필요사항
1. 실제 도메인 구매 (예: felix-radio.com)
2. Cloudflare에서 DNS 관리
3. DNS CNAME 레코드 5개 설정 (DNS only 모드)
4. Clerk Dashboard에서 커스텀 도메인 설정
5. SSL 인증서 자동 발급 대기 (최대 48시간)

#### 비용 및 시간
- **비용**: 연 $10-20 (도메인 비용)
- **소요 시간**: 최대 48시간 (DNS 전파)
- **난이도**: 중급

#### DNS 레코드 예시
```
Type: CNAME, Name: clerk, Target: frontend-api.clerk.services, Proxy: DNS only
Type: CNAME, Name: accounts, Target: accounts.clerk.services, Proxy: DNS only
Type: CNAME, Name: clkmail, Target: mail.xxx.clerk.services, Proxy: DNS only
Type: CNAME, Name: clk._domainkey, Target: dkim1.xxx.clerk.services, Proxy: DNS only
Type: CNAME, Name: clk2._domainkey, Target: dkim2.xxx.clerk.services, Proxy: DNS only
```

**핵심**: 모든 레코드를 **"DNS only"** 모드로 설정 (Cloudflare 프록시 OFF)

---

## 📚 참고 자료

- [Clerk Production Deployment](https://clerk.com/docs/deployments/overview)
- [Clerk with Cloudflare](https://clerk.com/docs/guides/development/deployment/production)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

---

## 💡 베스트 프랙티스

### 키 관리
- ✅ 환경 변수로만 관리
- ✅ `.env.local`은 `.gitignore`에 포함
- ✅ 프로덕션과 개발 키 분리
- ✅ Secret Key는 서버 사이드에서만 사용
- ❌ 절대 GitHub에 커밋하지 말 것

### 보안
- ✅ `authorizedParties` 설정으로 도메인 제한
- ✅ HTTPS 강제 사용
- ✅ 이메일 정보 필수 검증
- ✅ JWT 토큰 서버 사이드 검증
- ❌ 와일드카드 도메인 사용 지양

### 모니터링
- ✅ Clerk Dashboard에서 활성 사용자 확인
- ✅ 로그인 실패 패턴 모니터링
- ✅ API 에러 로그 정기 확인
- ✅ 정기적인 API 키 로테이션 (6개월마다)

---

**작성**: Claude Code
**업데이트**: 2026-01-02 (Vercel 배포 기준)
