import { SignUp } from '@clerk/nextjs';

export const runtime = 'edge';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-navy">🐱 Felix Radio</h1>
          <p className="mt-2 text-gray-600">Radio Recording & STT Service</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          routing="path"
          path="/signup"
          signInUrl="/login"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  );
}
