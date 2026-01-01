# 🔐 Clerk 프로덕션 설정 가이드

**작성일**: 2026-01-02
**참고**: [Clerk Production Deployment](https://clerk.com/docs/guides/development/deployment/production)

---

## 📋 개요

Clerk 인증을 프로덕션 환경에 배포하기 위한 단계별 가이드입니다.

---

## ✅ 프로덕션 배포 체크리스트

### 1단계: Clerk 프로덕션 인스턴스 생성

- [ ] https://dashboard.clerk.com 접속
- [ ] 인스턴스 선택기에서 **Create production instance** 클릭
- [ ] 개발 설정 복사 또는 기본값으로 시작
- [ ] ⚠️ 주의: SSO 연결, 통합, 경로 설정은 자동 복사되지 않음

### 2단계: API 키 확인

- [ ] **API Keys** 탭 이동
- [ ] Publishable Key 복사 (`pk_live_...`)
- [ ] Secret Key 복사 (`sk_live_...`)
- [ ] ⚠️ 주의: 절대 GitHub에 커밋하지 말 것

### 3단계: 환경 변수 설정

Cloudflare Pages 대시보드에서:

- [ ] Settings → Environment variables
- [ ] Production 환경에 다음 변수 추가:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://your-domain.pages.dev
NODE_ENV=production
```

### 4단계: Allowed Origins 설정

배포 완료 후 Clerk Dashboard에서:

- [ ] Settings → **Allowed Origins** 이동
- [ ] 프로덕션 도메인 추가:
  ```
  https://felix-radio.pages.dev
  또는
  https://your-custom-domain.com
  ```
- [ ] Save 클릭

### 5단계: Webhook 설정 (선택사항)

Webhook 사용 시:

- [ ] Webhooks 탭 이동
- [ ] 프로덕션 URL로 엔드포인트 업데이트
- [ ] Signing Secret 복사하여 환경 변수에 추가
- [ ] 테스트 이벤트 전송으로 확인

### 6단계: OAuth 제공자 설정 (선택사항)

소셜 로그인 사용 시:

- [ ] User & Authentication → Social Connections
- [ ] 각 제공자별 프로덕션 클라이언트 ID/Secret 설정
- [ ] 리디렉션 URL을 프로덕션 도메인으로 업데이트

---

## 🔒 보안 설정

### authorizedParties 설정

프로덕션에서 허용된 도메인만 요청하도록 제한:

```typescript
// apps/web/middleware.ts
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
}, {
  // Security: Restrict allowed request origins
  authorizedParties: process.env.NODE_ENV === 'production'
    ? [process.env.NEXT_PUBLIC_APP_URL || 'https://felix-radio.pages.dev']
    : undefined,
});
```

**목적**: Subdomain cookie leaking 공격 방지

---

## 🚨 일반적인 문제 해결

### 문제 1: "Invalid publishableKey" 에러

**원인**: 환경 변수가 설정되지 않았거나 잘못된 키 사용

**해결**:
1. Cloudflare Pages 환경 변수 확인
2. `pk_live_` 접두사로 시작하는지 확인
3. 재배포 후 확인

### 문제 2: "Origin not allowed" 에러

**원인**: Clerk Allowed Origins에 도메인이 추가되지 않음

**해결**:
1. Clerk Dashboard → Settings → Allowed Origins
2. 프로덕션 도메인 추가 (https 포함)
3. 저장 후 페이지 새로고침

### 문제 3: 빌드 시 "Missing publishableKey" 에러

**원인**: Next.js 빌드 타임에 환경 변수가 필요함

**해결**:
1. Cloudflare Pages의 **Production** 환경에 변수 설정
2. `NEXT_PUBLIC_` 접두사 확인
3. 재배포 트리거

### 문제 4: Cloudflare DNS 검증 실패

**원인**: Cloudflare 프록시 모드로 인한 DNS 검증 실패

**해결**:
1. Cloudflare DNS 설정에서 레코드를 "DNS only" 모드로 변경
2. Clerk에서 DNS 검증 재시도
3. 검증 후 프록시 모드 재활성화 가능

---

## 📊 배포 후 확인

### 기능 테스트

- [ ] 로그인/회원가입 정상 작동
- [ ] 대시보드 접근 권한 제어 확인
- [ ] 프로필 업데이트 테스트
- [ ] 로그아웃 정상 작동

### 보안 테스트

- [ ] 인증되지 않은 사용자는 대시보드 접근 불가
- [ ] HTTPS 연결 확인
- [ ] Cookie secure 플래그 확인
- [ ] CORS 설정 확인

---

## 🔄 환경 변수 업데이트 절차

환경 변수 변경 시:

1. Cloudflare Pages → Settings → Environment variables
2. 변수 수정
3. Save 클릭
4. Deployments → 최신 배포에서 **Retry deployment** 클릭
5. 빌드 로그 확인

---

## 📚 참고 자료

- [Clerk Production Deployment](https://clerk.com/docs/guides/development/deployment/production)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)

---

## 💡 베스트 프랙티스

### 키 관리

- ✅ 환경 변수로만 관리
- ✅ `.env.local`은 `.gitignore`에 포함
- ✅ 프로덕션과 개발 키 분리
- ❌ 절대 GitHub에 커밋하지 말 것

### 보안

- ✅ `authorizedParties` 설정으로 도메인 제한
- ✅ HTTPS 강제 사용
- ✅ Allowed Origins에 정확한 도메인만 추가
- ❌ 와일드카드 도메인 사용 지양

### 모니터링

- ✅ Clerk Dashboard에서 활성 사용자 확인
- ✅ 로그인 실패 패턴 모니터링
- ✅ Webhook 이벤트 로그 확인
- ✅ 정기적인 API 키 로테이션

---

**작성**: Claude Code
**업데이트**: 2026-01-02
